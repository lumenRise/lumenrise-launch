import { setTimeout as delay } from 'node:timers/promises';

import log from '../../logger';
import drainBaseScan from './drainBaseScan';
import getBaseContext from './getBaseContext';
import getBaseRuntime from './getBaseRuntime';
import acquireBaseLease from './acquireBaseLease';
import releaseBaseLease from './releaseBaseLease';
import reconcileBaseChain from './reconcileBaseChain';
import rebuildBaseHoldings from './rebuildBaseHoldings';
import type { BaseLoopMode } from '../../types/base/launch';
import initializeBaseLiveCursor from './initializeBaseLiveCursor';
import markBaseImagesForCleanup from './markBaseImagesForCleanup';
import type { BaseConfiguration } from '../../types/base/configuration';

const runBaseScanLoop = async (
  signal: AbortSignal,
  network: BaseConfiguration['network'],
  mode: BaseLoopMode,
): Promise<void> => {
  const runtime = getBaseRuntime(network);

  while (!signal.aborted) {
    const started = Date.now();

    try {
      if (mode === 'head') {
        const context = await getBaseContext(network);

        runtime.head = await context.client.getBlockNumber({ cacheTime: 0 });

        if (!runtime.initialized) {
          runtime.initialized = await initializeBaseLiveCursor(network, runtime.head);
        }

        if (runtime.initialized && !runtime.holdingsInitialized) {
          runtime.holdingsInitialized = await rebuildBaseHoldings(network);
        }

        if (runtime.initialized && started >= runtime.checkAt) {
          const writer = await acquireBaseLease(context);

          if (writer) {
            try {
              if (await reconcileBaseChain(writer)) {
                runtime.blocks.clear();

                runtime.historyActive = true;

                runtime.factoryAt = 0;

                runtime.poolAt = 0;
              }

              runtime.checkAt = Date.now() + 60_000;
            } finally {
              await releaseBaseLease(writer);
            }
          }
        }

        if (runtime.initialized && started >= runtime.cleanupAt) {
          await markBaseImagesForCleanup(network);

          runtime.cleanupAt = Date.now() + 60_000;
        }
      } else if (runtime.initialized && runtime.head !== undefined) {
        if (mode === 'live' && started >= runtime.factoryAt) {
          const caughtUp = await drainBaseScan(network, 'live', signal);

          if (caughtUp) {
            runtime.factoryAt = Date.now() + 60_000;
          }
        }

        if (mode === 'history' && runtime.historyActive) {
          runtime.historyActive = !(await drainBaseScan(network, 'history', signal));
        }

        if (mode === 'pool' && started >= runtime.poolAt) {
          const caughtUp = await drainBaseScan(network, 'pool', signal);

          if (caughtUp) {
            runtime.poolAt = Date.now() + 15_000;
          }
        }
      }
    } catch (error) {
      log.error({ error, chain: 'base', network, mode }, 'Base scan failed; progress retained');
    }

    try {
      await delay(Math.max(1, 5_000 - (Date.now() - started)), undefined, { signal });
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    }
  }
};

export default runBaseScanLoop;
