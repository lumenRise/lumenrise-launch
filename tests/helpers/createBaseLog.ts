import type { Log } from 'viem';
import { encodeEventTopics, encodeAbiParameters } from 'viem';

import launchAbi from '../../src/constants/base/launchAbi';

const createBaseLog = (index: number = 0, side: 'buy' | 'sell' = 'buy'): Log => ({
  address: '0x1111111111111111111111111111111111111111',
  blockNumber: 20n,
  blockHash: `0x${'a'.repeat(64)}`,
  transactionHash: `0x${'b'.repeat(64)}`,
  transactionIndex: 1,
  logIndex: index,
  removed: false,
  topics: (side === 'buy'
    ? encodeEventTopics({
        abi: launchAbi,
        eventName: 'Bought',
        args: { buyer: '0x2222222222222222222222222222222222222222' },
      })
    : encodeEventTopics({
        abi: launchAbi,
        eventName: 'Sold',
        args: { seller: '0x2222222222222222222222222222222222222222' },
      })) as Log['topics'],
  data: encodeAbiParameters(
    [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
    side === 'buy' ? [20_100_000n, 10n ** 18n, 100_000n] : [10n ** 18n, 19_900_000n, 100_000n],
  ),
});

export default createBaseLog;
