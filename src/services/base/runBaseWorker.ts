import log from '../../logger';
import runBaseScanLoop from './runBaseScanLoop';
import getBaseConfiguration from './getBaseConfiguration';
import startBaseTransactionWorker from './startBaseTransactionWorker';
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

  const queues = await Promise.all(networks.map((network) => startBaseTransactionWorker(network)));

  const workers = networks.flatMap((network): Promise<void>[] => [
    runBaseScanLoop(signal, network, 'head'),
    runBaseScanLoop(signal, network, 'live'),
    runBaseScanLoop(signal, network, 'history'),
    runBaseScanLoop(signal, network, 'pool'),
  ]);

  const results = await Promise.allSettled(workers);

  await Promise.all(queues.map((queue) => queue.stop()));

  for (const result of results) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
  }
};

export default runBaseWorker;
