import type { LaunchData } from './model';

interface StateTarget {
  factoryIndex: number;
  contractId: string;
  startsAt: string;
  endsAt: string;
  graduated: boolean;
  sold?: string;
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
    nextPollAt: Date | null,
  ): Promise<void>;
  deferStateTarget(index: number, nextPollAt: Date): Promise<void>;
}

export type { StateTarget, LaunchStore };
