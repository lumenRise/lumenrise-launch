import { setTimeout as delay } from 'node:timers/promises';

import log from '../../logger';
import createLaunchReader from './createLaunchReader';
import type { Configuration } from '../../types/configuration';

const createLaunchReaderWithRetry = async (
  configuration: Configuration,
  signal: AbortSignal,
): Promise<Awaited<ReturnType<typeof createLaunchReader>> | null> => {
  while (!signal.aborted) {
    try {
      const reader = await createLaunchReader(configuration);

      return signal.aborted ? null : reader;
    } catch (error) {
      log.warn(
        { error, chain: 'stellar', network: configuration.network, retryDelayMs: 5_000 },
        'Stellar RPC initialization deferred; other networks continue',
      );
    }

    try {
      await delay(5_000, undefined, { signal });
    } catch (error) {
      if (!signal.aborted) {
        throw error;
      }
    }
  }

  return null;
};

export default createLaunchReaderWithRetry;
