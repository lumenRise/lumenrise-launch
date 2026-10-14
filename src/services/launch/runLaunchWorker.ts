import { setTimeout as delay } from 'node:timers/promises';

import log from '../../logger';
import syncFactory from './syncFactory';
import createLaunchStore from './createLaunchStore';
import refreshLaunchState from './refreshLaunchState';
import createLaunchIndexes from './createLaunchIndexes';
import { connectDatabase, disconnectDatabase } from '../../db';
import createLaunchReader from '../stellar/createLaunchReader';
import startLaunchHolderWorker from './startLaunchHolderWorker';
import syncAssetIdentities from '../stellar/syncAssetIdentities';
import finalizeTokenImages from '../tokenImage/finalizeTokenImages';
import { loadConfiguration } from '../configuration/loadConfiguration';
import markTokenImagesForCleanup from '../tokenImage/markTokenImagesForCleanup';

const runLaunchWorker = async (): Promise<void> => {
  const configuration = loadConfiguration();
  const controller = new AbortController();
  const stop = () => controller.abort();

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  let holderWorker: { stop: () => Promise<void> } | null = null;

  await connectDatabase(configuration);

  try {
    await createLaunchIndexes();

    const reader = await createLaunchReader(configuration);
    const store = createLaunchStore(configuration);

    holderWorker = await startLaunchHolderWorker(reader, configuration);

    log.info(
      {
        network: configuration.network,
        factoryContractId: configuration.factoryContractId,
      },
      'Launch worker started',
    );

    let nextAssetIdentitySyncAt = 0;
    let nextTokenImageSyncAt = 0;
    let nextFactorySyncAt = 0;
    let nextTokenImageCleanupScanAt = 0;

    while (!controller.signal.aborted) {
      try {
        let added = 0;

        if (Date.now() >= nextFactorySyncAt) {
          added = await syncFactory(reader, store, configuration);
          nextFactorySyncAt = Date.now() + 30_000;
        }

        if (added > 0 || Date.now() >= nextTokenImageSyncAt) {
          await finalizeTokenImages(configuration);
          nextTokenImageSyncAt = Date.now() + 60_000;
        }

        if (Date.now() >= nextTokenImageCleanupScanAt && Date.now() < nextFactorySyncAt) {
          await markTokenImagesForCleanup(configuration);
          nextTokenImageCleanupScanAt = Date.now() + 60 * 60_000;
        }

        await refreshLaunchState(reader, store, new Date(), (error, contractId) => {
          log.warn({ error, contractId }, 'Launch state refresh failed');
        });

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
          log.info(
            {
              count: added,
              factoryContractId: configuration.factoryContractId,
            },
            'Launches indexed',
          );
        }
      } catch (error) {
        log.error({ error }, 'Launch sync failed');
      }

      try {
        await delay(configuration.pollIntervalMs, undefined, {
          signal: controller.signal,
        });
      } catch {
        if (!controller.signal.aborted) {
          throw new Error('Launch sync delay failed');
        }
      }
    }
  } finally {
    try {
      await holderWorker?.stop();
    } finally {
      await disconnectDatabase();
    }
  }
};

export default runLaunchWorker;
