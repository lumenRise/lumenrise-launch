import amqp from 'amqplib';
import type { ChannelModel, ConfirmChannel } from 'amqplib';

import env from '../../env';
import handleDomainMessage from './handleDomainMessage';
import type { DomainHandler, DomainErrorHandler, DomainWorker } from '../../types/messaging/domain';

const startDomainWorker = async (
  owner: 'launch' | 'reputation',
  handler: DomainHandler,
  onError: DomainErrorHandler,
): Promise<DomainWorker> => {
  let connection: ChannelModel | null = null;
  let channel: ConfirmChannel | null = null;
  let connecting: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let consumerTag: string | null = null;
  const active = new Set<Promise<void>>();

  const reconnect = (): void => {
    if (stopped || timer) {
      return;
    }

    timer = setTimeout((): void => {
      timer = undefined;

      void connect();
    }, 2000);
  };

  const connect = (): Promise<void> => {
    if (stopped || connecting || connection) {
      return connecting ?? Promise.resolve();
    }

    connecting = (async (): Promise<void> => {
      let next: ChannelModel | null = null;

      try {
        next = await amqp.connect(env.RABBITMQ_URL, { timeout: 2000 });

        if (stopped) {
          await next.close();

          return;
        }

        const connected = next;

        connected.on('error', onError);

        connected.on('close', (): void => {
          if (connection === connected) {
            connection = null;

            channel = null;
          }

          reconnect();
        });

        connection = connected;

        const nextChannel = await connected.createConfirmChannel();

        channel = nextChannel;

        nextChannel.on('error', onError);

        nextChannel.on('close', (): void => {
          if (channel === nextChannel && !stopped) {
            channel = null;

            connection = null;

            void connected.close().catch(onError);

            reconnect();
          }
        });

        const queue = `lumenrise.${owner}.requests.v1`;

        await nextChannel.assertQueue(queue, { durable: true });

        await nextChannel.prefetch(4);

        const consumer = await nextChannel.consume(queue, (message): void => {
          if (!message || stopped) {
            return;
          }

          const task = handleDomainMessage(nextChannel, message, handler).catch(
            (error: unknown): void => {
              onError(error);

              try {
                nextChannel.nack(message, false, true);
              } catch {
                // Closing the connection requeues any unacknowledged deliveries.
              }
            },
          );

          active.add(task);

          void task.finally((): void => {
            active.delete(task);
          });
        });

        consumerTag = consumer.consumerTag;
      } catch (error) {
        connection = null;

        channel = null;

        await next?.close().catch((): void => {});

        onError(error);

        reconnect();
      } finally {
        connecting = null;
      }
    })();

    return connecting;
  };

  void connect();

  return {
    stop: async (): Promise<void> => {
      stopped = true;

      clearTimeout(timer);

      await connecting;

      if (channel && consumerTag) {
        await channel.cancel(consumerTag).catch(onError);
      }

      await Promise.allSettled(active);

      await connection?.close().catch(onError);
    },
  };
};

export default startDomainWorker;
