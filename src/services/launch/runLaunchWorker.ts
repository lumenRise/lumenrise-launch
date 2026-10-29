import env from '../../env';
import log from '../../logger';
import runBaseWorker from '../base/runBaseWorker';
import runNetworkWorker from './runNetworkWorker';
import getBaseNetworks from '../base/getBaseNetworks';
import createLaunchIndexes from './createLaunchIndexes';
import getNetworkConfig from '../network/getNetworkConfig';
import { connectDatabase, disconnectDatabase } from '../../db';
import { loadConfiguration } from '../configuration/loadConfiguration';

const runLaunchWorker = async (): Promise<void> => {
  const configurations = (['testnet', 'public'] as const)
    .filter((network) => getNetworkConfig(network).factoryContractId)
    .map(loadConfiguration);

  const baseNetworks = getBaseNetworks();

  if (configurations.length === 0 && baseNetworks.length === 0) {
    log.info('No launch networks configured; configure a Stellar or Base factory');

    return;
  }

  const controller = new AbortController();
  const stop = (): void => controller.abort();

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    await connectDatabase(configurations[0] ?? { dbUri: env.DB_URI, dbName: env.DB_NAME });

    await createLaunchIndexes();

    const workers = configurations.map(async (configuration): Promise<void> => {
      try {
        await runNetworkWorker(configuration, controller.signal);
      } catch (error) {
        log.error({ err: error, network: configuration.network }, 'Launch network worker failed');

        controller.abort();

        throw error;
      }
    });

    if (baseNetworks.length > 0) {
      workers.push(
        runBaseWorker(controller.signal, baseNetworks).catch((error: unknown): never => {
          log.error({ err: error, chain: 'base' }, 'Base launch worker failed');

          controller.abort();

          throw error;
        }),
      );
    }

    const results = await Promise.allSettled(workers);

    for (const result of results) {
      if (result.status === 'rejected') {
        throw result.reason;
      }
    }
  } finally {
    controller.abort();

    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);

    await disconnectDatabase();
  }

  log.info('Launch network workers stopped');
};

export default runLaunchWorker;
