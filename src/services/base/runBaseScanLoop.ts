import { setTimeout as delay } from 'node:timers/promises';

import log from '../../logger';
import scanBaseNetwork from './scanBaseNetwork';
import type { BaseScanMode } from '../../types/base/launch';
import initializeBaseLiveCursor from './initializeBaseLiveCursor';
import type { BaseConfiguration } from '../../types/base/configuration';

const runBaseScanLoop = async (
  signal: AbortSignal,
  network: BaseConfiguration['network'],
  mode: BaseScanMode,
): Promise<void> => {
  let initialized = mode === 'history';

  while (!signal.aborted) {
    try {
      if (!initialized) {
        initialized = await initializeBaseLiveCursor(network);
      }

      if (initialized && !signal.aborted) {
        await scanBaseNetwork(network, mode);
      }
    } catch (error) {
      log.error(
        { error, chain: 'base', network, mode },
        'Base scan failed; cursor retained for retry',
      );
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

export default runBaseScanLoop;
