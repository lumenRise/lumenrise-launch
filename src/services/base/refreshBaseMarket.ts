import type { Address } from 'viem';

import Launch from '../../models/Launch';
import readBaseLaunch from './readBaseLaunch';
import LaunchHolder from '../../models/LaunchHolder';
import tokenAbi from '../../constants/base/tokenAbi';
import LaunchPriceSample from '../../models/LaunchPriceSample';
import type { BaseEventContext } from '../../types/base/launch';

const refreshBaseMarket = async (
  context: BaseEventContext,
  contractId: string,
  blockNumber: bigint,
  timestamp: bigint,
  traders: string[],
  rewind: boolean = false,
): Promise<void> => {
  const identity = { chain: 'base' as const, network: context.configuration.network, contractId };
  const launch = await Launch.findOne(identity).session(context.session).lean();

  if (!launch) {
    throw new Error('Base trade contract has not been indexed');
  }

  const read = await readBaseLaunch({ context, address: contractId as Address, blockNumber });
  const observedAt = new Date(Number(timestamp) * 1000);

  await Launch.updateOne(
    { ...identity, ...(rewind ? {} : { stateAsOfLedger: { $lte: Number(blockNumber) } }) },
    {
      $set: {
        state: read.state,
        stateAsOfLedger: Number(blockNumber),
        stateObservedAt: new Date(),
        nextStatePollAt: new Date(Date.now() + 900_000),
      },
    },
    { session: context.session },
  );

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

  for (const address of new Set(traders)) {
    const balance = await context.client.readContract({
      address: launch.asset as Address,
      abi: tokenAbi,
      functionName: 'balanceOf',
      args: [address as Address],
      blockNumber,
    });

    if (balance.toString().length > 39) {
      throw new Error('Base holder balance exceeds the supported contract range');
    }

    const key = { ...identity, address };
    const existing = await LaunchHolder.findOne(key).session(context.session).lean();

    if (
      !rewind &&
      existing?.observedBlock !== undefined &&
      existing.observedBlock > Number(blockNumber)
    ) {
      continue;
    }

    // Keep zero-balance observations internally so a delayed receipt cannot restore stale balances.
    await LaunchHolder.updateOne(
      key,
      {
        $set: {
          asset: launch.asset,
          balance: balance.toString(),
          balanceSort: balance.toString().padStart(39, '0'),
          observedAt,
          observedBlock: Number(blockNumber),
        },
      },
      { upsert: true, session: context.session },
    );
  }
};

export default refreshBaseMarket;
