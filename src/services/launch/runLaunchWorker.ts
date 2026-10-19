import log from '../../logger';
import runNetworkWorker from './runNetworkWorker';
import createLaunchIndexes from './createLaunchIndexes';
import getNetworkConfig from '../network/getNetworkConfig';
import { connectDatabase, disconnectDatabase } from '../../db';
import { loadConfiguration } from '../configuration/loadConfiguration';

const runLaunchWorker = async (): Promise<void> => {
  const configurations = ([
    'testnet',
    // 'public', // Public network automation is temporarily disabled.
  ] as const)
    .filter((network) => getNetworkConfig(network).factoryContractId)
    .map(loadConfiguration);

  if (configurations.length === 0) {
    throw new Error('Configure the testnet launch factory');
  }

  const controller = new AbortController();
  const stop = () => controller.abort();

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  await connectDatabase(configurations[0]!);

  try {
    await createLaunchIndexes();

    const results = await Promise.allSettled(
      configurations.map(async (configuration): Promise<void> => {
        try {
          await runNetworkWorker(configuration, controller.signal);
        } catch (error) {
          controller.abort();

          throw error;
        }
      }),
    );

    for (const result of results) {
      if (result.status === 'rejected') {
        throw result.reason;
      }
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);

    await disconnectDatabase();
  }

  log.info('Launch network workers stopped');
};

export default runLaunchWorker;
