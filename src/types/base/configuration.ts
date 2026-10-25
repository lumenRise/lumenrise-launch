import type { Address, PublicClient } from 'viem';

interface BaseConfiguration {
  network: 'testnet' | 'public';
  chainId: 8453 | 84532;
  rpcUrl: string;
  factoryAddress: Address;
  deploymentBlock: bigint;
  batchSize: bigint;
}

interface BaseContext {
  configuration: BaseConfiguration;
  client: PublicClient;
}

export type { BaseConfiguration, BaseContext };
