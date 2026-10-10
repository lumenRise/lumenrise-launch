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
  nextStatePollAt?: Date;
}

interface StateTarget {
  factoryIndex: number;
  contractId: string;
  startsAt: string;
  endsAt: string;
  graduated: boolean;
}

interface LaunchReader {
  launchTransaction(
    hash: string,
  ): Promise<{
    status: 'SUCCESS' | 'FAILED' | 'PENDING';
    contractId: string | null;
    params: unknown;
  }>;
  launchCount(): Promise<ChainRead<number>>;
  launchAt(index: number): Promise<ChainRead<string | null>>;
  launchConfig(contractId: string): Promise<ChainRead<unknown>>;
  launchState(contractId: string): Promise<ChainRead<unknown>>;
}

interface LaunchStore {
  nextIndex(): Promise<number>;
  save(launch: LaunchData): Promise<void>;
  advance(nextIndex: number): Promise<void>;
  dueStateTargets(now: Date, limit: number): Promise<StateTarget[]>;
  refreshState(
    index: number,
    state: Record<string, unknown>,
    ledger: number,
    nextPollAt: Date,
  ): Promise<void>;
  deferStateTarget(index: number, nextPollAt: Date): Promise<void>;
}

export type { ChainRead, LaunchData, LaunchReader, LaunchStore, StateTarget };
