import type { Chain } from '../network/chain';

interface LaunchHolderRecord {
  chain?: Chain;
  network: 'testnet' | 'public';
  contractId: string;
  address: string;
  asset: string;
  balance: string;
  balanceSort: string;
  netRecordedAmount?: string;
  balanceSource?: string;
  observedBlock?: number;
  observedAt: Date;
}

interface HolderJobReader {
  chain?: Chain;
  network: 'testnet' | 'public';
}

export type { LaunchHolderRecord, HolderJobReader };
