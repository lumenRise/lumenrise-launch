import { setTimeout as delay } from 'node:timers/promises';

import log from '../../logger';
import syncFactory from './syncFactory';
import createLaunchStore from './createLaunchStore';
import refreshLaunchState from './refreshLaunchState';
import createScheduledTask from './createScheduledTask';
import type { Configuration } from '../../types/configuration';
import createLaunchReader from '../stellar/createLaunchReader';
import startLaunchHolderWorker from './startLaunchHolderWorker';
import syncAssetIdentities from '../stellar/syncAssetIdentities';
import finalizeTokenImages from '../tokenImage/finalizeTokenImages';
import type { ScheduledTask } from '../../types/launch/scheduledTask';
import markTokenImagesForCleanup from '../tokenImage/markTokenImagesForCleanup';

const runNetworkWorker = async (
  configuration: Configuration,
  signal: AbortSignal,
): Promise<void> => {
  const tasks: ScheduledTask[] = [];

  let holderWorker: { stop: () => Promise<void> } | null = null;

  try {
    const reader = await createLaunchReader(configuration);
    const store = createLaunchStore(configuration);

    holderWorker = await startLaunchHolderWorker(reader, configuration);

    log.info(
      {
        chain: 'stellar',
        network: configuration.network,
        factoryContractId: configuration.factoryContractId,
      },
      'Stellar launch worker started',
    );

    let reconcileFactory = true;

    const imageTask = createScheduledTask({
      name: 'token image finalization',
      intervalMs: 60_000,
      retryMs: 60_000,
      run: () => finalizeTokenImages(configuration),
    });

    const cleanupTask = createScheduledTask({
      name: 'token image cleanup scan',
      intervalMs: 60 * 60_000,
      retryMs: 60_000,
      run: () => markTokenImagesForCleanup(configuration),
    });

    const assetTask = createScheduledTask({
      name: 'asset identity sync',
      intervalMs: 60 * 60_000,
      retryMs: 15 * 60_000,
      run: () => syncAssetIdentities(configuration),
    });

    const factoryTask = createScheduledTask({
      name: 'factory sync',
      intervalMs: 30_000,
      retryMs: 30_000,
      run: async (): Promise<void> => {
        const added = await syncFactory(reader, store, configuration, reconcileFactory);

        reconcileFactory = false;

        if (added > 0) {
          imageTask.request();

          assetTask.request();

          log.info(
            { count: added, factoryContractId: configuration.factoryContractId },
            'Stellar launches indexed',
          );
        }
      },
    });

    tasks.push(factoryTask, imageTask, cleanupTask, assetTask);

    while (!signal.aborted) {
      factoryTask.tick();

      if (!reconcileFactory) {
        imageTask.tick();

        cleanupTask.tick();

        assetTask.tick();
      }

      try {
        await refreshLaunchState(reader, store, new Date(), (error, contractId) => {
          log.warn(
            { err: error, network: reader.network, contractId, retryDelayMs: 30_000 },
            'Stellar launch state refresh failed',
          );
        });
      } catch (error) {
        log.error({ err: error }, 'Stellar launch state polling failed');
      }

      try {
        await delay(configuration.pollIntervalMs, undefined, {
          signal: signal,
        });
      } catch {
        if (!signal.aborted) {
          throw new Error('Launch sync delay failed');
        }
      }
    }
  } finally {
    await Promise.all(tasks.map((task: ScheduledTask): Promise<void> => task.stop()));
    await holderWorker?.stop();
  }
};

export default runNetworkWorker;
