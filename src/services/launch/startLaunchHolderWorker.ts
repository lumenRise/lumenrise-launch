import amqp from 'amqplib';

import log from '../../logger';
import parseJobId from '../../workers/parseJobId';
import type { Configuration } from '../../types/configuration';
import { startPolledQueueWorker } from '../../workers/polledQueue';
import type { HolderBalanceReader } from '../../types/launch/holder';
import { LAUNCH_HOLDER_QUEUE } from '../../constants/launch/holderQueue';
import processLaunchHolderJob from '../../workers/processLaunchHolderJob';

const startLaunchHolderWorker = async (
  reader: HolderBalanceReader,
  configuration: Configuration,
) => {
  const worker = await startPolledQueueWorker({
    broker: null,
    queue: LAUNCH_HOLDER_QUEUE,
    pollIntervalMs: configuration.pollIntervalMs,
    processJob: (jobId) => processLaunchHolderJob(reader, jobId),
    parseJobId,
    label: 'Launch holders',
  });

  let broker: Awaited<ReturnType<typeof amqp.connect>> | null = null;
  let connecting: Promise<void> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const reconnect = () => {
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
        const connected = await amqp.connect(configuration.rabbitmqUrl ?? 'amqp://127.0.0.1:5672', {
          timeout: 5000,
        });

        connection = connected;

        connected.on('error', (error: unknown) =>
          log.warn({ error }, 'Launch RabbitMQ connection error'),
        );

        connected.on('close', () => {
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

export default startLaunchHolderWorker;
