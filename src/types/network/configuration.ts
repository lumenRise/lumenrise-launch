type StellarNetwork = 'testnet' | 'public';

interface NetworkConfiguration {
  network: StellarNetwork;
  rpcUrl: string;
  horizonUrl: string;
  networkPassphrase: string;
  factoryContractId: string;
  homeDomain: string;
  tomlPath: string;
}

export type { StellarNetwork, NetworkConfiguration };
