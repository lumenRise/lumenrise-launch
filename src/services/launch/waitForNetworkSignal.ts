import type { Chain } from '../../types/network/chain';
import networkActivityEvents from './networkActivityEvents';

const waitForNetworkSignal = async (chain: Chain, signal: AbortSignal): Promise<void> => {
  if (signal.aborted) {
    return;
  }

  let finish: () => void = (): void => {};

  const waiting = new Promise<void>((resolve: () => void): void => {
    finish = resolve;
  });

  const timer = setTimeout(finish, 5_000);

  networkActivityEvents.once(chain, finish);

  signal.addEventListener('abort', finish, { once: true });

  try {
    await waiting;
  } finally {
    clearTimeout(timer);

    networkActivityEvents.removeListener(chain, finish);

    signal.removeEventListener('abort', finish);
  }
};

export default waitForNetworkSignal;
