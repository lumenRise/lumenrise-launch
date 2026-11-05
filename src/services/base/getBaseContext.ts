import { http, createPublicClient } from 'viem';

import getBaseConfiguration from './getBaseConfiguration';
import type { BaseContext } from '../../types/base/configuration';

const contexts = new Map<string, BaseContext>();

const getBaseContext = async (network: 'testnet' | 'public'): Promise<BaseContext> => {
  const configuration = getBaseConfiguration(network);

  if (!configuration) {
    throw new Error(`Base ${network} is not configured`);
  }

  const key = `${network}:${configuration.rpcUrl}:${configuration.factoryAddress}`;
  const existing = contexts.get(key);

  if (existing) {
    return existing;
  }

  const client = createPublicClient({
    transport: http(configuration.rpcUrl, { timeout: 15_000, retryCount: 2 }),
  });

  const context = { configuration, client };

  contexts.set(key, context);

  return context;
};

export default getBaseContext;
