import { Keypair, StrKey } from '@stellar/stellar-sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LaunchData } from '../../../src/types/launch/model';
import syncFactory from '../../../src/services/launch/syncFactory';
import type { LaunchStore } from '../../../src/types/launch/store';
import type { LaunchReader } from '../../../src/types/launch/reader';
import type { Configuration } from '../../../src/types/configuration';
import nextStatePollAt from '../../../src/utils/launch/nextStatePollAt';
import refreshLaunchState from '../../../src/services/launch/refreshLaunchState';

vi.mock('../../../src/logger', () => ({ default: { info: vi.fn() } }));

vi.mock('../../../src/models/LaunchPriceSample', () => ({
  default: { exists: vi.fn().mockResolvedValue(null) },
}));
vi.mock('../../../src/services/launch/recordLaunchPrice', () => ({ default: vi.fn() }));

const factoryContractId = StrKey.encodeContract(Buffer.alloc(32, 1));
const childContractId = StrKey.encodeContract(Buffer.alloc(32, 2));
const asset = StrKey.encodeContract(Buffer.alloc(32, 3));
const pair = StrKey.encodeContract(Buffer.alloc(32, 4));
const owner = Keypair.random().publicKey();

const configuration: Configuration = {
  network: 'testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  factoryContractId,
  observerAddress: owner,
  rpcUrl: 'https://example.test',
  dbUri: 'mongodb://localhost:27017',
  dbName: 'test',
  pollIntervalMs: 1000,
};

const config = {
  factory: factoryContractId,
  platform: owner,
  platform_fee_bps: 100,
  params: {
    owner,
    asset,
    pair,
    metadata: { name: 'Launch', description: '', logo: '', symbol: 'LAUNCH' },
    allocations: { pool_bps: 2000, curve_bps: 7000, team_bps: 1000 },
    vesting: { cliff_seconds: 0n, duration_seconds: 2_592_000n, schedule: { tag: 'Weekly' } },
    curve: {
      virtual_base_reserve: 21_000_000n,
      virtual_quote_reserve: 21_000_000n,
      graduation_target: 4_000_000n,
      creator_fee_bps: 10,
      creator_payout_bps: 1000,
    },
    starts_at: 1_800_000_000n,
    ends_at: 1_801_209_600n,
  },
  total_supply: 10000000n,
  buckets: { pool: 2_000_000n, curve: 7_000_000n, team: 1_000_000n },
};

const state = {
  sold: 0n,
  quote_reserve: 0n,
  creator_fees: 0n,
  team_claimed: 0n,
  buyer_count: 0,
  graduated: false,
  busy: false,
};

describe('syncFactory', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(1_800_000_000_000));
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    { cursor: 9, existing: [1, 2, 3, 4, 6, 7, 8], missing: [5] },
    { cursor: 9, existing: [2, 3, 4, 5, 6, 7], missing: [1, 8] },
    { cursor: 1, existing: [1, 2, 3, 4, 6, 7, 8], missing: [5] },
    { cursor: 1, existing: [1, 2, 3, 4, 5, 6, 7, 8], missing: [] },
    { cursor: 9, existing: [], missing: [1, 2, 3, 4, 5, 6, 7, 8] },
  ])(
    'recovers only missing indexes on startup with cursor $cursor and indexes $existing',
    async ({ cursor, existing, missing }) => {
      const saved = new Set(existing);
      const lookups: number[] = [];
      let nextIndex = cursor;

      const reader: LaunchReader = {
        network: 'testnet',
        launchCount: async () => ({ value: 8, ledger: 100 }),
        launchAt: async (index: number) => {
          lookups.push(index);

          return { value: StrKey.encodeContract(Buffer.alloc(32, index + 10)), ledger: 100 };
        },
        launchConfig: async () => ({ value: config, ledger: 101 }),
        launchState: async () => ({ value: state, ledger: 102 }),
        launchPrice: async () => ({ value: 10_000_000n, ledger: 103 }),
      };

      const store: LaunchStore = {
        nextIndex: async () => nextIndex,
        indexedIndexes: async (count: number) => {
          expect(count).toBe(8);

          return [...saved];
        },
        save: async (launch: LaunchData) => {
          saved.add(launch.factoryIndex);
        },
        advance: async (index: number) => {
          nextIndex = Math.max(nextIndex, index);
        },
        dueStateTargets: async () => [],
        refreshState: async () => true,
        deferStateTarget: async () => {},
      };

      expect(await syncFactory(reader, store, configuration, true)).toBe(missing.length);

      expect(lookups).toEqual(missing);
      expect([...saved].sort((a: number, b: number): number => a - b)).toEqual([
        1, 2, 3, 4, 5, 6, 7, 8,
      ]);
      expect(nextIndex).toBe(9);

      expect(await syncFactory(reader, store, configuration)).toBe(0);
      expect(lookups).toEqual(missing);
    },
  );

  it('retries startup reconciliation after a failed recovery with an advanced cursor', async () => {
    const saved = new Set([1, 2, 3, 4, 6, 7, 8]);
    const readIndexes = vi.fn(async (): Promise<number[]> => [...saved]);
    let failOnce = true;

    const save = vi.fn(async (launch: LaunchData): Promise<void> => {
      if (failOnce) {
        failOnce = false;

        throw new Error('temporary database error');
      }

      saved.add(launch.factoryIndex);
    });

    const reader: LaunchReader = {
      network: 'testnet',
      launchCount: async () => ({ value: 8, ledger: 100 }),
      launchAt: async () => ({ value: childContractId, ledger: 100 }),
      launchConfig: async () => ({ value: config, ledger: 101 }),
      launchState: async () => ({ value: state, ledger: 102 }),
      launchPrice: async () => ({ value: 10_000_000n, ledger: 103 }),
    };

    const store: LaunchStore = {
      nextIndex: async () => 9,
      indexedIndexes: readIndexes,
      save,
      advance: vi.fn(),
      dueStateTargets: async () => [],
      refreshState: async () => true,
      deferStateTarget: async () => {},
    };

    await expect(syncFactory(reader, store, configuration, true)).rejects.toThrow();

    expect(store.advance).not.toHaveBeenCalled();
    expect(saved.has(5)).toBe(false);

    expect(await syncFactory(reader, store, configuration, true)).toBe(1);
    expect(saved.has(5)).toBe(true);
    expect(readIndexes).toHaveBeenCalledTimes(2);
  });

  it('retries a failed save without advancing the cursor and does not duplicate a launch', async () => {
    let nextIndex = 1;
    let failOnce = true;
    const saved = new Map<number, LaunchData>();

    const reader: LaunchReader = {
      network: 'testnet',
      launchPrice: async () => ({ value: 10_000_000n, ledger: 111 }),
      launchCount: async () => ({ value: 1, ledger: 100 }),
      launchAt: async () => ({ value: childContractId, ledger: 100 }),
      launchConfig: async () => ({ value: config, ledger: 101 }),
      launchState: async () => ({ value: state, ledger: 102 }),
    };

    const store: LaunchStore = {
      indexedIndexes: async () => [],
      nextIndex: async () => nextIndex,
      save: async (launch) => {
        if (failOnce) {
          failOnce = false;
          throw new Error('temporary database error');
        }
        saved.set(launch.factoryIndex, launch);
      },
      advance: async (index) => {
        nextIndex = index;
      },
      dueStateTargets: async () => [],
      refreshState: async () => true,
      deferStateTarget: async () => {},
    };

    await expect(syncFactory(reader, store, configuration)).rejects.toThrow(
      'temporary database error',
    );
    expect(nextIndex).toBe(1);
    expect(await syncFactory(reader, store, configuration)).toBe(1);
    expect(await syncFactory(reader, store, configuration)).toBe(0);
    expect(saved.size).toBe(1);
    expect(saved.get(1)?.config.total_supply).toBe('10000000');
    expect(
      (saved.get(1)?.config.params as { curve: { graduation_target: string } }).curve
        .graduation_target,
    ).toBe('4000000');
    expect(saved.get(1)?.state.sold).toBe('0');
    expect(saved.get(1)?.state.creator_fees).toBe('0');
    expect(nextIndex).toBe(2);
  });

  it('rejects a child whose config belongs to another factory', async () => {
    const reader: LaunchReader = {
      network: 'testnet',
      launchPrice: async () => ({ value: 10_000_000n, ledger: 111 }),
      launchCount: async () => ({ value: 1, ledger: 100 }),
      launchAt: async () => ({ value: childContractId, ledger: 100 }),
      launchConfig: async () => ({ value: { ...config, factory: asset }, ledger: 101 }),
      launchState: async () => ({ value: state, ledger: 102 }),
    };

    const store: LaunchStore = {
      indexedIndexes: async () => [],
      nextIndex: async () => 1,
      save: async () => {
        throw new Error('must not save');
      },
      advance: async () => {
        throw new Error('must not advance');
      },
      dueStateTargets: async () => [],
      refreshState: async () => {
        throw new Error('must not refresh');
      },
      deferStateTarget: async () => {},
    };

    await expect(syncFactory(reader, store, configuration)).rejects.toThrow(
      'Invalid on-chain launch config',
    );
  });

  it('refreshes only due launches with a bounded number of contract reads', async () => {
    let savedState: Record<string, unknown> | null = null;
    let nextPollAt: Date | null = null;
    let stateReads = 0;
    const now = new Date(1_800_000_000_000);

    const reader: LaunchReader = {
      network: 'testnet',
      launchPrice: async () => ({ value: 10_000_000n, ledger: 111 }),
      launchCount: async () => {
        throw new Error('unneeded count read');
      },
      launchAt: async () => {
        throw new Error('unneeded factory lookup');
      },
      launchConfig: async () => ({ value: config, ledger: 110 }),
      launchState: async () => {
        stateReads += 1;
        return { value: { ...state, sold: 100n }, ledger: 111 };
      },
    };

    const store: LaunchStore = {
      indexedIndexes: async () => [],
      nextIndex: async () => 2,
      save: async () => {},
      advance: async () => {},
      dueStateTargets: async (_now, limit) => {
        expect(limit).toBe(2);
        return [
          {
            factoryIndex: 1,
            claimedUntil: new Date(now.getTime() + 120_000),
            contractId: childContractId,
            startsAt: '1800000000',
            endsAt: '1801209600',
            graduated: false,
          },
        ];
      },
      refreshState: async (_index, value, _ledger, next) => {
        savedState = value;
        nextPollAt = next;

        return true;
      },
      deferStateTarget: async () => {
        throw new Error('must not defer');
      },
    };

    expect(await refreshLaunchState(reader, store, now)).toBe(1);

    expect(savedState).toMatchObject({ sold: '100' });
    expect(nextPollAt).toEqual(new Date(now.getTime() + 900_000));
    expect(stateReads).toBe(1);
  });

  it('uses slower intervals for closed curves and retries an RPC failure later', async () => {
    const now = new Date(1_800_000_000_000);
    const target = {
      claimedUntil: new Date(now.getTime() + 120_000),
      factoryIndex: 1,
      contractId: childContractId,
      startsAt: '1790000000',
      endsAt: '1791000000',
      graduated: false,
    };
    expect(nextStatePollAt(target, false, now)).toEqual(new Date(now.getTime() + 900_000));
    expect(nextStatePollAt(target, true, now)).toBeNull();
    expect(nextStatePollAt(target, false, now, '0')).toBeNull();
    expect(
      nextStatePollAt({ ...target, startsAt: '1800000010', endsAt: '1800001000' }, false, now, '0'),
    ).toEqual(new Date(now.getTime() + 10_000));

    let deferred: Date | null = null;
    const reader: LaunchReader = {
      network: 'testnet',
      launchPrice: async () => ({ value: 10_000_000n, ledger: 111 }),
      launchCount: async () => {
        throw new Error('unneeded count read');
      },
      launchAt: async () => {
        throw new Error('unneeded factory lookup');
      },
      launchConfig: async () => {
        throw new Error('unneeded config read');
      },
      launchState: async () => {
        throw new Error('temporary RPC error');
      },
    };
    const store: LaunchStore = {
      indexedIndexes: async () => [],
      nextIndex: async () => 2,
      save: async () => {},
      advance: async () => {},
      dueStateTargets: async () => [target],
      refreshState: async () => {
        throw new Error('must not save');
      },
      deferStateTarget: async (_index, next) => {
        deferred = next;
      },
    };
    expect(await refreshLaunchState(reader, store, now)).toBe(0);
    expect(deferred).toEqual(new Date(now.getTime() + 30_000));
  });

  it('continues with the next launch when retry scheduling also fails', async () => {
    const now = new Date(1_800_000_000_000);
    const targets = [1, 2].map((factoryIndex) => ({
      claimedUntil: new Date(now.getTime() + 120_000),
      factoryIndex,
      contractId: `${childContractId}-${factoryIndex}`,
      startsAt: '1800000000',
      endsAt: '1801209600',
      graduated: false,
    }));
    const errors: unknown[] = [];
    const refreshed: number[] = [];
    const reader: LaunchReader = {
      network: 'testnet',
      launchPrice: async () => ({ value: 10_000_000n, ledger: 111 }),
      launchCount: async () => {
        throw new Error('unneeded count read');
      },
      launchAt: async () => {
        throw new Error('unneeded factory lookup');
      },
      launchConfig: async () => {
        throw new Error('unneeded config read');
      },
      launchState: async (contractId) => {
        if (contractId === targets[0].contractId) {
          throw new Error('RPC failed');
        }
        return { value: state, ledger: 111 };
      },
    };
    const store: LaunchStore = {
      indexedIndexes: async () => [],
      nextIndex: async () => 3,
      save: async () => {},
      advance: async () => {},
      dueStateTargets: async () => targets,
      refreshState: async (index) => {
        refreshed.push(index);

        return true;
      },
      deferStateTarget: async () => {
        throw new Error('Database failed');
      },
    };

    expect(await refreshLaunchState(reader, store, now, (error) => errors.push(error))).toBe(1);
    expect(refreshed).toEqual([2]);
    expect(errors).toHaveLength(2);
  });
});
