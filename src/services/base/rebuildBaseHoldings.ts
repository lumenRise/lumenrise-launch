import mongoose from 'mongoose';

import Launch from '../../models/Launch';
import getBaseContext from './getBaseContext';
import BaseCursor from '../../models/BaseCursor';
import acquireBaseLease from './acquireBaseLease';
import releaseBaseLease from './releaseBaseLease';
import refreshRecordedHoldings from './refreshRecordedHoldings';

const rebuildBaseHoldings = async (network: 'testnet' | 'public'): Promise<boolean> => {
  const context = await acquireBaseLease(await getBaseContext(network));

  if (!context) {
    return false;
  }

  try {
    const launches = await Launch.find({
      chain: 'base',
      network,
      factoryContractId: context.configuration.factoryAddress,
      holderSource: { $ne: 'recorded_trades' },
    }).lean();

    for (const launch of launches) {
      await mongoose.connection.transaction(async (session): Promise<void> => {
        const locked = await BaseCursor.updateOne(
          {
            network,
            factoryAddress: context.configuration.factoryAddress,
            leaseOwner: context.leaseOwner,
            leaseUntil: { $gt: new Date() },
          },
          { $set: { leaseUntil: new Date(Date.now() + 300_000) } },
          { session },
        );

        if (locked.matchedCount !== 1) {
          throw new Error('Base holder rebuild lease expired');
        }

        await refreshRecordedHoldings({ ...context, session }, launch.contractId);
      });
    }

    return true;
  } finally {
    await releaseBaseLease(context);
  }
};

export default rebuildBaseHoldings;
