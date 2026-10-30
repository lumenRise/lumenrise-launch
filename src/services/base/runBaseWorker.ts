import log from '../../logger';
import runBaseScanLoop from './runBaseScanLoop';
import getBaseConfiguration from './getBaseConfiguration';
import type { BaseConfiguration } from '../../types/base/configuration';

const runBaseWorker = async (
  signal: AbortSignal,
  networks: BaseConfiguration['network'][],
): Promise<void> => {
  if (networks.length === 0 || signal.aborted) {
    return;
  }

  for (const network of networks) {
    log.info(
      { chain: 'base', network, factoryContractId: getBaseConfiguration(network)?.factoryAddress },
      'Base launch worker started',
    );
  }

  const workers = networks.flatMap((network): Promise<void>[] => [
    runBaseScanLoop(signal, network, 'live'),
    runBaseScanLoop(signal, network, 'history'),
  ]);

  const results = await Promise.allSettled(workers);

  for (const result of results) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
  }
};

export default runBaseWorker;
