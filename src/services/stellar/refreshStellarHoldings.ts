import type { ClientSession } from 'mongoose';

import Launch from '../../models/Launch';
import LaunchTrade from '../../models/LaunchTrade';
import LaunchHolder from '../../models/LaunchHolder';
import type { MarketIdentity } from '../../types/launch/market';
import calculateRecordedHoldings from '../base/calculateRecordedHoldings';

const refreshStellarHoldings = async (
  identity: MarketIdentity,
  session: ClientSession,
): Promise<void> => {
  const launch = await Launch.findOne(identity).session(session).lean();

  if (!launch) {
    return;
  }

  await Launch.updateOne(identity, { $inc: { recordedHoldingsVersion: 1 } }, { session });

  const trades = await LaunchTrade.find(identity).session(session).lean();
  const holdings = calculateRecordedHoldings(trades, 'stellar');

  await LaunchHolder.deleteMany(identity, { session: session });

  for (const holding of holdings) {
    const balance = holding.amount > 0n ? holding.amount.toString() : '0';

    await LaunchHolder.updateOne(
      { ...identity, address: holding.address },
      {
        $set: {
          asset: launch.asset,
          balance,
          balanceSort: balance.padStart(39, '0'),
          netRecordedAmount: holding.amount.toString(),
          balanceSource: 'recorded_trades',
          observedAt: holding.observedAt,
          observedBlock: holding.observedBlock,
        },
      },
      { upsert: true, session: session },
    );
  }

  await Launch.updateOne(
    identity,
    { $set: { holderSource: 'recorded_trades' } },
    { session: session },
  );
};

export default refreshStellarHoldings;
