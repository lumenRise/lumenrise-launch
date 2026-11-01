import type { Log } from 'viem';
import { encodeEventTopics, encodeAbiParameters } from 'viem';

import poolAbi from '../../src/constants/base/poolAbi';
import { pool, poolId, router } from './basePoolFixture';

const createBaseSwapLog = (
  assetDelta: bigint = 10n ** 18n,
  pairDelta: bigint = -2000000n,
): Log => ({
  address: pool.poolManager,
  blockNumber: 20n,
  blockHash: `0x${'a'.repeat(64)}`,
  transactionHash: `0x${'b'.repeat(64)}`,
  transactionIndex: 1,
  logIndex: 4,
  removed: false,
  topics: encodeEventTopics({
    abi: poolAbi,
    eventName: 'Swap',
    args: { id: poolId, sender: router },
  }),
  data: encodeAbiParameters(
    [
      { type: 'int128' },
      { type: 'int128' },
      { type: 'uint160' },
      { type: 'uint128' },
      { type: 'int24' },
      { type: 'uint24' },
    ],
    [assetDelta, pairDelta, 1n << 96n, 340490822233631430n, 0, 3000],
  ),
});

export default createBaseSwapLog;
