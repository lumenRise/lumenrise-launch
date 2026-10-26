import env from '../../env';
import isBaseAddress from '../../utils/base/isBaseAddress';
import type { BaseConfiguration } from '../../types/base/configuration';

const getBaseConfiguration = (network: 'testnet' | 'public'): BaseConfiguration | null => {
  const rpcUrl = network === 'testnet' ? env.BASE_TESTNET_RPC_URL : env.BASE_PUBLIC_RPC_URL;

  const factory =
    network === 'testnet' ? env.BASE_TESTNET_FACTORY_ADDRESS : env.BASE_PUBLIC_FACTORY_ADDRESS;

  const start =
    network === 'testnet' ? env.BASE_TESTNET_DEPLOYMENT_BLOCK : env.BASE_PUBLIC_DEPLOYMENT_BLOCK;

  if (!rpcUrl && !factory && !start) {
    return null;
  }

  if (!rpcUrl || !isBaseAddress(factory) || !/^\d+$/.test(start)) {
    throw new Error(
      `Base ${network} RPC, factory address and deployment block must be configured together`,
    );
  }

  const url = new URL(rpcUrl);

  if (
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) ||
    url.username ||
    url.password ||
    url.hash ||
    !Number.isInteger(env.BASE_LOG_BATCH_SIZE) ||
    env.BASE_LOG_BATCH_SIZE < 1 ||
    env.BASE_LOG_BATCH_SIZE > 10_000
  ) {
    throw new Error('Invalid Base RPC configuration');
  }

  return {
    network,
    chainId: network === 'testnet' ? 84532 : 8453,
    rpcUrl,
    factoryAddress: factory.toLowerCase() as BaseConfiguration['factoryAddress'],
    deploymentBlock: BigInt(start),
    batchSize: BigInt(env.BASE_LOG_BATCH_SIZE),
  };
};

export default getBaseConfiguration;
