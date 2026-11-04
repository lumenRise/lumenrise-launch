import mongoose from 'mongoose';

import type { MarketIdentity } from '../../types/launch/market';
import type { HolderJobReader } from '../../types/launch/holder';
import refreshStellarHoldings from '../stellar/refreshStellarHoldings';

const refreshLaunchHolder = async (
  _reader: HolderJobReader,
  identity: MarketIdentity,
): Promise<void> => {
  await mongoose.connection.transaction(async (session): Promise<void> => {
    await refreshStellarHoldings({ ...identity, chain: 'stellar' }, session);
  });
};

export default refreshLaunchHolder;
