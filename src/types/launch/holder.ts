interface LaunchHolderRecord {
  network: 'testnet' | 'public';
  contractId: string;
  address: string;
  asset: string;
  balance: string;
  balanceSort: string;
  observedAt: Date;
}

interface HolderBalanceReader {
  network: 'testnet' | 'public';
  tokenBalance(asset: string, address: string): Promise<unknown>;
}

export type { LaunchHolderRecord, HolderBalanceReader };
