import type { LaunchData } from './model';

interface StateTarget {
  factoryIndex: number;
  contractId: string;
  startsAt: string;
  endsAt: string | null;
  graduated: boolean;
  sold?: string;
  state?: Record<string, unknown>;
}

interface ClaimedStateTarget extends StateTarget {
  claimedUntil: Date;
}

interface LaunchStore {
  nextIndex(): Promise<number>;
  indexedIndexes(count: number): Promise<number[]>;
  save(launch: LaunchData): Promise<boolean | void>;
  advance(nextIndex: number): Promise<void>;
  dueStateTargets(now: Date, limit: number): Promise<ClaimedStateTarget[]>;
  refreshState(
    index: number,
    state: Record<string, unknown>,
    ledger: number,
    nextPollAt: Date | null,
    claimedUntil: Date,
  ): Promise<boolean>;
  deferStateTarget(index: number, nextPollAt: Date, claimedUntil: Date): Promise<void>;
}

export type { StateTarget, LaunchStore, ClaimedStateTarget };
