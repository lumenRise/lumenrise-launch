import type { Address, PublicClient, TransactionReceipt } from 'viem';

interface BaseConfiguration {
  network: 'testnet' | 'public';
  rpcUrl: string;
  factoryAddress: Address;
  deploymentBlock: bigint;
  batchSize: bigint;
}

interface BaseContext {
  configuration: BaseConfiguration;
  client: PublicClient;
  receipts?: Map<string, TransactionReceipt>;
}

export type { BaseConfiguration, BaseContext };
