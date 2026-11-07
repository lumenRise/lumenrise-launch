import type { Chain } from '../../types/network/chain';
import TestnetActivity from '../../models/TestnetActivity';
import type { StellarNetwork } from '../../types/network/configuration';

const isNetworkActive = async (chain: Chain, network: StellarNetwork): Promise<boolean> => {
  if (network === 'public') {
    return true;
  }

  const activity = await TestnetActivity.findById(chain).lean();

  return activity?.network === 'testnet' && activity.activeUntil.getTime() > Date.now();
};

export default isNetworkActive;
