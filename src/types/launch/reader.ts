import type { LaunchCreation } from './creation';

interface ChainRead<T> {
  value: T;
  ledger: number;
}

interface LaunchReader {
  network: 'testnet' | 'public';
  launchCreation?(contractId: string): Promise<LaunchCreation | null>;
  launchCount(): Promise<ChainRead<number>>;
  launchAt(index: number): Promise<ChainRead<string | null>>;
  launchConfig(contractId: string): Promise<ChainRead<unknown>>;
  launchState(contractId: string): Promise<ChainRead<unknown>>;
  launchPrice(contractId: string): Promise<ChainRead<unknown>>;
}

export type { ChainRead, LaunchReader };
