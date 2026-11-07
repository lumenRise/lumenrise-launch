import getBaseRuntime from './getBaseRuntime';
import scanBaseNetwork from './scanBaseNetwork';
import isNetworkActive from '../launch/isNetworkActive';
import type { BaseScanMode } from '../../types/base/launch';

const drainBaseScan = async (
  network: 'testnet' | 'public',
  mode: BaseScanMode,
  signal: AbortSignal,
): Promise<boolean> => {
  const runtime = getBaseRuntime(network);

  while (!signal.aborted) {
    if (!(await isNetworkActive('base', network))) {
      return false;
    }

    const caughtUp = await scanBaseNetwork(network, mode);

    if (caughtUp || !runtime.progress.get(mode)) {
      return caughtUp;
    }
  }

  return false;
};

export default drainBaseScan;
