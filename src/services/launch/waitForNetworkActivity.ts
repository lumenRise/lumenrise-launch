import log from '../../logger';
import isNetworkActive from './isNetworkActive';
import type { Chain } from '../../types/network/chain';
import waitForNetworkSignal from './waitForNetworkSignal';
import type { StellarNetwork } from '../../types/network/configuration';

const waitForNetworkActivity = async (
  chain: Chain,
  network: StellarNetwork,
  signal: AbortSignal,
): Promise<boolean> => {
  let sleeping = false;

  while (!signal.aborted) {
    try {
      if (await isNetworkActive(chain, network)) {
        if (sleeping) {
          log.info({ chain, network }, 'Testnet polling resumed from saved progress');
        }

        return !signal.aborted;
      }
    } catch (error) {
      log.warn({ err: error, chain, network }, 'Testnet activity lookup failed; polling deferred');
    }

    if (!sleeping) {
      log.info({ chain, network }, 'Testnet polling paused until API activity');

      sleeping = true;
    }

    await waitForNetworkSignal(chain, signal);
  }

  return false;
};

export default waitForNetworkActivity;
