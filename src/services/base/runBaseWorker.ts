import { setTimeout as delay } from 'node:timers/promises';

import log from '../../logger';
import scanBaseNetwork from './scanBaseNetwork';
import getBaseConfiguration from './getBaseConfiguration';
import type { BaseConfiguration } from '../../types/base/configuration';

const runBaseWorker = async (
  signal: AbortSignal,
  networks: BaseConfiguration['network'][],
): Promise<void> => {
  if (networks.length === 0) {
    return;
  }

  for (const network of networks) {
    log.info(
      {
        chain: 'base',
        network,
        factoryContractId: getBaseConfiguration(network)?.factoryAddress,
      },
      'Base launch worker started',
    );
  }

  while (!signal.aborted) {
    for (const network of networks) {
      if (signal.aborted) {
        break;
      }

      try {
        await scanBaseNetwork(network);
      } catch (error) {
        log.error({ error, chain: 'base', network }, 'Base scan failed; cursor retained for retry');
      }
    }

    try {
      await delay(2_000, undefined, { signal });
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    }
  }
};

export default runBaseWorker;
