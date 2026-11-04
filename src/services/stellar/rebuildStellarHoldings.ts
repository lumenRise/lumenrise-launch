import mongoose from 'mongoose';

import Launch from '../../models/Launch';
import refreshStellarHoldings from './refreshStellarHoldings';
import type { StellarNetwork } from '../../types/network/configuration';

const rebuildStellarHoldings = async (network: StellarNetwork): Promise<void> => {
  const launches = await Launch.find({
    chain: 'stellar',
    network,
    holderSource: { $ne: 'recorded_trades' },
  }).lean();

  for (const launch of launches) {
    await mongoose.connection.transaction(async (session): Promise<void> => {
      await refreshStellarHoldings(
        { chain: 'stellar', network, contractId: launch.contractId },
        session,
      );
    });
  }
};

export default rebuildStellarHoldings;
