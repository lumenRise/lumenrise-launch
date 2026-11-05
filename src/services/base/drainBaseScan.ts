import getBaseRuntime from './getBaseRuntime';
import scanBaseNetwork from './scanBaseNetwork';
import type { BaseScanMode } from '../../types/base/launch';

const drainBaseScan = async (
  network: 'testnet' | 'public',
  mode: BaseScanMode,
  signal: AbortSignal,
): Promise<boolean> => {
  const runtime = getBaseRuntime(network);

  while (!signal.aborted) {
    const caughtUp = await scanBaseNetwork(network, mode);

    if (caughtUp || !runtime.progress.get(mode)) {
      return caughtUp;
    }
  }

  return false;
};

export default drainBaseScan;
