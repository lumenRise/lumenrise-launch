import type { Chain } from '../network/chain';

interface LaunchHolderRecord {
  chain?: Chain;
  network: 'testnet' | 'public';
  contractId: string;
  address: string;
  asset: string;
  balance: string;
  balanceSort: string;
  observedBlock?: number;
  observedAt: Date;
}

interface HolderBalanceReader {
  chain?: Chain;
  network: 'testnet' | 'public';
  tokenBalance(asset: string, address: string): Promise<unknown>;
}

export type { LaunchHolderRecord, HolderBalanceReader };
