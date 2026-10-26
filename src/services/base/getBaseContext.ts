import { http, createPublicClient } from 'viem';

import getBaseConfiguration from './getBaseConfiguration';
import type { BaseContext } from '../../types/base/configuration';

const getBaseContext = async (network: 'testnet' | 'public'): Promise<BaseContext> => {
  const configuration = getBaseConfiguration(network);

  if (!configuration) {
    throw new Error(`Base ${network} is not configured`);
  }

  const client = createPublicClient({
    transport: http(configuration.rpcUrl, { timeout: 15_000, retryCount: 2 }),
  });

  if ((await client.getChainId()) !== configuration.chainId) {
    throw new Error('Base RPC chain ID mismatch');
  }

  return { configuration, client };
};

export default getBaseContext;
