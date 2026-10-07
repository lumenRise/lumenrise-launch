interface Configuration {
  network: 'testnet' | 'public';
  networkPassphrase: string;
  factoryContractId: string;
  observerAddress: string;
  rpcUrl: string;
  horizonUrl: string;
  dbUri: string;
  dbName: string;
  pollIntervalMs: number;
}

export type { Configuration };
