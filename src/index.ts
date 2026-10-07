import mongoose from 'mongoose';
import { setTimeout as delay } from 'node:timers/promises';

import log from './logger';
import Launch from './store/Launch';
import syncFactory from './syncFactory';
import FactoryCursor from './store/FactoryCursor';
import AssetIdentity from './store/AssetIdentity';
import { loadConfiguration } from './configuration';
import refreshLaunchState from './refreshLaunchState';
import syncAssetIdentities from './syncAssetIdentities';
import createLaunchStore from './store/createLaunchStore';
import createLaunchReader from './chain/createLaunchReader';

const main = async (): Promise<void> => {
  const configuration = loadConfiguration();
  const controller = new AbortController();
  const stop = () => controller.abort();

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  mongoose.set('autoIndex', false);
  await mongoose.connect(configuration.dbUri, { dbName: configuration.dbName });
  log.info({ database: configuration.dbName }, 'Launch database connected');

  try {
    await Promise.all([Launch.createIndexes(), FactoryCursor.createIndexes(), AssetIdentity.createIndexes()]);

    const reader = await createLaunchReader(configuration);
    const store = createLaunchStore(configuration);

    log.info(
      { network: configuration.network, factoryContractId: configuration.factoryContractId },
      'Launch worker started',
    );

    let nextAssetIdentitySyncAt = 0;

    while (!controller.signal.aborted) {
      try {
        const added = await syncFactory(reader, store, configuration);
        await refreshLaunchState(reader, store);

        if (added > 0 || Date.now() >= nextAssetIdentitySyncAt) {
          nextAssetIdentitySyncAt = Date.now() + 15 * 60 * 1000;

          try {
            await syncAssetIdentities(configuration);
            nextAssetIdentitySyncAt = Date.now() + 60 * 60 * 1000;
          } catch (error) {
            log.warn({ error }, 'Asset identity sync is temporarily unavailable');
          }
        }

        if (added > 0) {
          log.info({ count: added, factoryContractId: configuration.factoryContractId }, 'Launches indexed');
        }
      } catch (error) {
        log.error({ error }, 'Launch sync failed');
      }

      try {
        await delay(configuration.pollIntervalMs, undefined, { signal: controller.signal });
      } catch {
        if (!controller.signal.aborted) {
          throw new Error('Launch sync delay failed');
        }
      }
    }
  } finally {
    await mongoose.disconnect();
    log.info('Launch database disconnected');
  }
};

void main().catch((error: unknown) => {
  log.fatal({ error }, 'Launch worker failed');
  process.exitCode = 1;
});
