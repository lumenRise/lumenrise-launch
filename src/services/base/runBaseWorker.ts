import mongoose from 'mongoose';
import { setTimeout as delay } from 'node:timers/promises';

import env from '../../env';
import log from '../../logger';
import scanBaseNetwork from './scanBaseNetwork';
import BaseCursor from '../../models/BaseCursor';
import BaseCheckpoint from '../../models/BaseCheckpoint';
import getBaseConfiguration from './getBaseConfiguration';

const runBaseWorker = async (): Promise<void> => {
  const networks = (
    [
      'testnet',
      // 'public',
    ] as const
  ).filter((network): boolean => getBaseConfiguration(network) !== null);

  if (networks.length === 0) {
    log.info('Base is disabled; configure RPC, factory address and deployment block to enable it');

    return;
  }

  const controller = new AbortController();
  const stop = (): void => controller.abort();

  process.once('SIGINT', stop);

  process.once('SIGTERM', stop);

  mongoose.set('autoIndex', false);

  await mongoose.connect(env.DB_URI, { dbName: env.DB_NAME });

  try {
    await BaseCursor.createIndexes();

    await BaseCheckpoint.createIndexes();

    while (!controller.signal.aborted) {
      for (const network of networks) {
        try {
          await scanBaseNetwork(network);
        } catch (error) {
          log.error({ error, network }, 'Base scan failed; cursor retained for retry');
        }
      }

      try {
        await delay(2_000, undefined, { signal: controller.signal });
      } catch (error) {
        if (!controller.signal.aborted) {
          throw error;
        }
      }
    }
  } finally {
    process.removeListener('SIGINT', stop);

    process.removeListener('SIGTERM', stop);

    await mongoose.disconnect();
  }
};

export default runBaseWorker;
