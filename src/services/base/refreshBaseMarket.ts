import type { Address } from 'viem';

import Launch from '../../models/Launch';
import readBaseLaunch from './readBaseLaunch';
import LaunchPriceSample from '../../models/LaunchPriceSample';
import type { BaseEventContext } from '../../types/base/launch';

const refreshBaseMarket = async (
  context: BaseEventContext,
  contractId: string,
  blockNumber: bigint,
  timestamp: bigint,
  _traders: string[],
  rewind: boolean = false,
): Promise<void> => {
  const identity = { chain: 'base' as const, network: context.configuration.network, contractId };
  const launch = await Launch.findOne(identity).session(context.session).lean();

  if (!launch) {
    throw new Error('Base trade contract has not been indexed');
  }

  const read = await readBaseLaunch({ context, address: contractId as Address, blockNumber });
  const observedAt = new Date(Number(timestamp) * 1000);

  const updated = await Launch.updateOne(
    { ...identity, ...(rewind ? {} : { stateAsOfLedger: { $lte: Number(blockNumber) } }) },
    {
      $set: {
        state: read.state,
        pool: read.pool ?? null,
        graduationState: read.graduationState ?? null,
        graduationBlock: read.state.graduated
          ? (launch.graduationBlock ?? Number(blockNumber))
          : null,
        ...(read.state.graduated ? {} : { poolNextBlock: null }),
        stateAsOfLedger: Number(blockNumber),
        stateObservedAt: new Date(),
        nextStatePollAt: new Date(Date.now() + 900_000),
      },
    },
    { session: context.session },
  );

  const stateChanged = Object.keys(read.state).some(
    (key: string): boolean => launch.state[key] !== read.state[key],
  );

  if (updated?.matchedCount === 1 && stateChanged) {
    context.events?.push({
      message: 'Base launch state changed',
      data: { ...identity, ledger: Number(blockNumber), state: read.state },
    });
  }

  await LaunchPriceSample.updateOne(
    { ...identity, observationKey: blockNumber.toString() },
    {
      $setOnInsert: {
        bucket: observedAt,
        sampledAt: observedAt,
        ledger: Number(blockNumber),
        price: read.price.toString(),
        priceSort: read.price.toString().padStart(78, '0'),
      },
    },
    { upsert: true, session: context.session },
  );
};

export default refreshBaseMarket;
