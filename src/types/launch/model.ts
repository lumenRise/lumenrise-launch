interface LaunchData {
  network: 'testnet' | 'public';
  factoryContractId: string;
  factoryIndex: number;
  contractId: string;
  owner: string;
  asset: string;
  pair: string;
  metadata: {
    name: string;
    description: string;
    logo: string;
    symbol: string;
    website?: string;
    xAccount?: string;
  };
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  asOfLedger: number;
  observedAt: Date;
  stateAsOfLedger: number;
  stateObservedAt: Date;
  nextStatePollAt?: Date | null;
}

export type { LaunchData };
