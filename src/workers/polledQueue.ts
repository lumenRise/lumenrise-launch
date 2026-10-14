import type { ChannelModel, ConfirmChannel, ConsumeMessage } from 'amqplib';

import log from '../logger';

type QueueWorker = {
  attachBroker: (broker: ChannelModel) => Promise<void>;
  stop: () => Promise<void>;
};

const startPolledQueueWorker = async ({
  broker,
  queue,
  pollIntervalMs,
  processJob,
  parseJobId,
  label,
}: {
  broker: ChannelModel | null;
  queue: string;
  pollIntervalMs: number;
  processJob: (jobId?: string) => Promise<void>;
  parseJobId: (message: ConsumeMessage) => string | null;
  label: string;
}): Promise<QueueWorker> => {
  let active: Promise<void> | null = null;
  let channel: ConfirmChannel | null = null;
  let consumerTag: string | null = null;
  let stopped = false;

  const run = (jobId?: string): Promise<void> => {
    if (stopped) {
      return Promise.resolve();
    }

    if (active) {
      return jobId ? active.catch(() => {}).then(() => run(jobId)) : active;
    }

    active = processJob(jobId).finally(() => {
      active = null;
    });

    return active;
  };

  const timer = setInterval(() => {
    void run().catch((error: unknown) =>
      log.error({ error, queue, label }, 'Queue reconciliation failed'),
    );
  }, pollIntervalMs);
  void run().catch((error: unknown) =>
    log.error({ error, queue, label }, 'Queue reconciliation failed'),
  );

  const attachBroker = async (connection: ChannelModel): Promise<void> => {
    if (stopped) {
      throw new Error(`${label} worker has stopped`);
    }
    if (channel) {
      throw new Error(`${label} broker is already attached`);
    }

    const nextChannel = await connection.createConfirmChannel();
    // A channel can emit an error before its connection emits close.
    nextChannel.on?.('error', (error: unknown) =>
      log.error({ error, queue, label }, 'Queue channel failed'),
    );
    nextChannel.on?.('close', () => {
      if (channel === nextChannel) {
        channel = null;
        consumerTag = null;
      }
    });

    try {
      await nextChannel.assertQueue(queue, { durable: true });
      await nextChannel.prefetch(1);
      const consumer = await nextChannel.consume(queue, async (message) => {
        if (!message) {
          return;
        }
        const jobId = parseJobId(message);
        if (!jobId) {
          try {
            nextChannel.nack(message, false, false);
          } catch {
            /* closed channel */
          }
          return;
        }
        try {
          await run(jobId);
        } catch (error) {
          // The MongoDB record remains eligible for reconciliation or lease recovery.
          log.error({ error, queue, label, jobId }, 'Queue delivery failed');
        } finally {
          try {
            nextChannel.ack(message);
          } catch {
            /* broker will redeliver */
          }
        }
      });
      channel = nextChannel;
      consumerTag = consumer.consumerTag;
    } catch (error) {
      await nextChannel.close().catch(() => {});
      throw error;
    }
  };

  try {
    if (broker) {
      await attachBroker(broker);
    }
  } catch (error) {
    clearInterval(timer);
    await (active as Promise<void> | null)?.catch(() => {});
    throw error;
  }

  return {
    attachBroker,
    stop: async () => {
      if (stopped) {
        return;
      }
      stopped = true;
      clearInterval(timer);
      const closingChannel = channel;
      channel = null;
      if (closingChannel && consumerTag) {
        await closingChannel.cancel(consumerTag).catch(() => {});
      }
      await active?.catch(() => {});
      if (closingChannel) {
        await closingChannel.close().catch(() => {});
      }
    },
  };
};

export { startPolledQueueWorker };
export type { QueueWorker };
