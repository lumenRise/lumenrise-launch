import type { Block } from 'viem';

import getBaseRuntime from './getBaseRuntime';
import type { BaseContext } from '../../types/base/configuration';

const readBaseBlock = async (context: BaseContext, number: bigint): Promise<Block> => {
  const runtime = getBaseRuntime(context.configuration.network);
  const key = number.toString();
  let pending = runtime.blocks.get(key);

  if (!pending) {
    pending = context.client.getBlock({ blockNumber: number });

    runtime.blocks.set(key, pending);
  }

  return pending;
};

export default readBaseBlock;
