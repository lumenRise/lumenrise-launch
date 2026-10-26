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
      launch: '0x1111111111111111111111111111111111111111',
      owner: '0x2222222222222222222222222222222222222222',
    },
  }) as Log['topics'],
  data: encodeAbiParameters([{ type: 'uint32' }], [index]),
});

export default createBaseCreationLog;
