interface ChainRead<T> {
  value: T;
  ledger: number;
}

interface LaunchData {
  network: 'testnet' | 'public';
  factoryContractId: string;
  factoryIndex: number;
  contractId: string;
  owner: string;
  asset: string;
  pair: string;
  metadata: { name: string; description: string; logo: string; symbol: string };
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  asOfLedger: number;
  observedAt: Date;
  stateAsOfLedger: number;
  stateObservedAt: Date;
}

interface LaunchReader {
  launchCount(): Promise<ChainRead<number>>;
  launchAt(index: number): Promise<ChainRead<string | null>>;
  launchConfig(contractId: string): Promise<ChainRead<unknown>>;
  launchState(contractId: string): Promise<ChainRead<unknown>>;
}

interface LaunchStore {
  nextIndex(): Promise<number>;
  save(launch: LaunchData): Promise<void>;
  advance(nextIndex: number): Promise<void>;
  nextStateIndex(): Promise<number>;
  refreshState(index: number, state: Record<string, unknown>, ledger: number): Promise<void>;
  advanceState(nextIndex: number): Promise<void>;
}

export type { ChainRead, LaunchData, LaunchReader, LaunchStore };
