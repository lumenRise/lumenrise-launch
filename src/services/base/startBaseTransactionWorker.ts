import amqp from 'amqplib';

import env from '../../env';
import log from '../../logger';
import parseJobId from '../../workers/parseJobId';
import { startPolledQueueWorker } from '../../workers/polledQueue';
import processBaseTransactionJob from '../../workers/processBaseTransactionJob';

const startBaseTransactionWorker = async (
  network: 'testnet' | 'public',
): Promise<{ stop: () => Promise<void> }> => {
  const worker = await startPolledQueueWorker({
    broker: null,
    queue: `launch.base.transactions.${network}`,
    pollIntervalMs: 2000,
    processJob: (jobId?: string): Promise<void> => processBaseTransactionJob(network, jobId),
    parseJobId,
    label: 'Base transactions',
  });

  let broker: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  let connecting: Promise<void> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const reconnect = (): void => {
    if (stopped || retryTimer) {
      return;
    }

    retryTimer = setTimeout(() => {
      retryTimer = null;

      void connect();
    }, 5000);
  };

  const connect = (): Promise<void> => {
    if (stopped || broker || connecting) {
      return connecting ?? Promise.resolve();
    }

    connecting = (async () => {
      let connection: Awaited<ReturnType<typeof amqp.connect>> | null = null;

      try {
        const connected = await amqp.connect(env.RABBITMQ_URL, {
          timeout: 5000,
        });

        connection = connected;

        log.info({ chain: 'base', network }, 'Launch RabbitMQ connected');

        connected.on('error', (error: unknown) =>
          log.warn({ error }, 'Launch RabbitMQ connection error'),
        );

        connected.on('close', () => {
          log.info({ chain: 'base', network }, 'Launch RabbitMQ disconnected');

          if (broker === connected) {
            broker = null;
          }

          reconnect();
        });

        broker = connected;

        await worker.attachBroker(connected);
      } catch (error) {
        if (broker === connection) {
          broker = null;
        }

        await connection?.close().catch(() => {});

        log.warn({ error }, 'RabbitMQ unavailable; holder job reconciliation continues');

        reconnect();
      } finally {
        connecting = null;
      }
    })();

    return connecting;
  };

  void connect();

  return {
    stop: async () => {
      stopped = true;

      if (retryTimer) {
        clearTimeout(retryTimer);
      }

      await connecting;

      await worker.stop();

      await broker?.close().catch(() => {});
    },
  };
};

export default startBaseTransactionWorker;
