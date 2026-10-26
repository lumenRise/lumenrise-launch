import type { Log } from 'viem';
import { encodeEventTopics, encodeAbiParameters } from 'viem';

import launchAbi from '../../src/constants/base/launchAbi';

const createBaseLog = (index: number = 0): Log => ({
  address: '0x1111111111111111111111111111111111111111',
  blockNumber: 20n,
  blockHash: `0x${'a'.repeat(64)}`,
  transactionHash: `0x${'b'.repeat(64)}`,
  transactionIndex: 1,
  logIndex: index,
  removed: false,
  topics: encodeEventTopics({
    abi: launchAbi,
    eventName: 'Trade',
    args: { trader: '0x2222222222222222222222222222222222222222' },
  }) as Log['topics'],
  data: encodeAbiParameters(
    [
      { type: 'bool' },
      { type: 'uint128' },
      { type: 'uint128' },
      { type: 'uint128' },
      { type: 'uint128' },
    ],
    [true, 10_000_000n, 20_000_000n, 100_000n, 20_100_000n],
  ),
});

export default createBaseLog;
