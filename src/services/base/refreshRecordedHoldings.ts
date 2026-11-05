import Launch from '../../models/Launch';
import LaunchTrade from '../../models/LaunchTrade';
import LaunchHolder from '../../models/LaunchHolder';
import type { BaseEventContext } from '../../types/base/launch';
import calculateRecordedHoldings from './calculateRecordedHoldings';

const refreshRecordedHoldings = async (
  context: BaseEventContext,
  contractId: string,
): Promise<void> => {
  const identity = { chain: 'base' as const, network: context.configuration.network, contractId };
  const launch = await Launch.findOne(identity).session(context.session).lean();

  if (!launch) {
    return;
  }

  const trades = await LaunchTrade.find(identity).session(context.session).lean();
  const holdings = calculateRecordedHoldings(trades);

  await LaunchHolder.deleteMany(identity, { session: context.session });

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
      { upsert: true, session: context.session },
    );
  }

  await Launch.updateOne(
    identity,
    { $set: { holderSource: 'recorded_trades' } },
    { session: context.session },
  );
};

export default refreshRecordedHoldings;
