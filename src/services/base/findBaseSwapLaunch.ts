import type { Hex, Address } from 'viem';

import Launch from '../../models/Launch';
import readBaseLaunch from './readBaseLaunch';
import type { BaseEventContext } from '../../types/base/launch';
import type { LaunchData as LaunchRecord } from '../../types/launch/model';

const findBaseSwapLaunch = async (
  context: BaseEventContext,
  poolId: Hex,
  blockNumber: bigint,
): Promise<LaunchRecord | null> => {
  const scope = {
    chain: 'base' as const,
    network: context.configuration.network,
    factoryContractId: context.configuration.factoryAddress,
  };

  const known = await Launch.findOne({ ...scope, 'pool.poolId': poolId })
    .session(context.session)
    .lean();

  if (known) {
    return known;
  }

  // Bootstrap launches indexed before pool tracking was enabled.
  const candidates = await Launch.find({
    ...scope,
    pool: null,
    'state.graduated': true,
    creationLedger: { $lte: Number(blockNumber) },
  })
    .session(context.session)
    .lean();

  for (const launch of candidates) {
    const snapshot = await readBaseLaunch({
      context,
      address: launch.contractId as Address,
      blockNumber,
    });

    if (snapshot.pool?.poolId === poolId) {
      return launch;
    }
  }

  return null;
};

export default findBaseSwapLaunch;
