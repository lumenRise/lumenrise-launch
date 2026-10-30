import type { Log } from 'viem';
import { encodeAbiParameters, encodeEventTopics } from 'viem';

import createBaseLog from './createBaseLog';
import factoryAbi from '../../src/constants/base/factoryAbi';

const createBaseCreationLog = (index: number = 1): Log => ({
  ...createBaseLog(),
  address: '0x3333333333333333333333333333333333333333',
  topics: encodeEventTopics({
    abi: factoryAbi,
    eventName: 'LaunchCreated',
    args: {
      index: BigInt(index),
      curve: '0x1111111111111111111111111111111111111111',
      owner: '0x2222222222222222222222222222222222222222',
    },
  }) as Log['topics'],
  data: encodeAbiParameters(
    [{ type: 'address' }, { type: 'uint256' }],
    ['0x4444444444444444444444444444444444444444', 1_000_000n * 10n ** 18n],
  ),
});

export default createBaseCreationLog;
