import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Launch from '../../../src/models/Launch';
import type { Configuration } from '../../../src/types/configuration';
import createLaunchStore from '../../../src/services/launch/createLaunchStore';

vi.mock('../../../src/models/Launch', () => ({
  default: { findOneAndUpdate: vi.fn(), updateOne: vi.fn(), exists: vi.fn(), distinct: vi.fn() },
}));

const now = new Date('2026-10-17T00:00:00Z');

const configuration: Configuration = {
  network: 'testnet',
  networkPassphrase: 'testnet',
  factoryContractId: 'factory',
  rpcUrl: 'https://rpc.test',
  dbUri: 'mongodb://localhost:27017',
  dbName: 'test',
  pollIntervalMs: 5000,
};

const launch = {
  factoryIndex: 5,
  contractId: 'curve',
  config: { params: { starts_at: '1', ends_at: '9999999999' } },
  state: { graduated: false, sold: '100' },
};

let scheduledAt: Date | null | undefined;

describe('exclusive launch polling and trade schedule ownership', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.useFakeTimers();

    vi.setSystemTime(now);

    scheduledAt = new Date(now.getTime() - 1);

    vi.mocked(Launch.findOneAndUpdate).mockImplementation(
      (_filter, update) =>
        ({
          select: () => ({
            lean: async () => {
              if (scheduledAt === null || (scheduledAt && scheduledAt.getTime() > Date.now())) {
                return null;
              }

              const change = update as { $set: { nextStatePollAt: Date } };

              scheduledAt = change.$set.nextStatePollAt;

              return launch;
            },
          }),
        }) as never,
    );

    vi.mocked(Launch.updateOne).mockImplementation((filter, update) => {
      const condition = filter as { nextStatePollAt: Date };
      const change = update as { $set: { nextStatePollAt: Date | null } };
      const matches = scheduledAt?.getTime() === condition.nextStatePollAt.getTime();

      if (matches) {
        scheduledAt = change.$set.nextStatePollAt;
      }

      return Promise.resolve({ matchedCount: matches ? 1 : 0 }) as never;
    });

    vi.mocked(Launch.exists).mockResolvedValue({ _id: 'launch' } as never);
  });

  afterEach(() => vi.useRealTimers());

  it('recognizes indexed launches even when their creation date is unavailable', async () => {
    const store = createLaunchStore(configuration);

    vi.mocked(Launch.distinct).mockResolvedValue([5]);

    expect(await store.indexedIndexes(8)).toEqual([5]);

    expect(Launch.distinct).toHaveBeenCalledWith('factoryIndex', {
      chain: 'stellar',
      network: 'testnet',
      factoryContractId: 'factory',
      factoryIndex: { $gte: 1, $lte: 8 },
    });
  });

  it('allows only one worker to claim a due launch and recovers an abandoned claim', async () => {
    const first = createLaunchStore(configuration);
    const second = createLaunchStore(configuration);

    const [firstTargets, secondTargets] = await Promise.all([
      first.dueStateTargets(now, 2),
      second.dueStateTargets(now, 2),
    ]);

    expect(firstTargets).toHaveLength(1);

    expect(secondTargets).toHaveLength(0);

    expect(Launch.findOneAndUpdate).toHaveBeenCalledWith(
      {
        chain: 'stellar',
        network: 'testnet',
        factoryContractId: 'factory',
        $or: [{ nextStatePollAt: { $lte: now } }, { nextStatePollAt: { $exists: false } }],
      },
      { $set: { nextStatePollAt: new Date(now.getTime() + 120_000) } },
      { sort: { nextStatePollAt: 1, factoryIndex: 1 }, returnDocument: 'after' },
    );

    await vi.advanceTimersByTimeAsync(120_000);

    const recovered = await second.dueStateTargets(new Date(), 2);

    expect(recovered).toHaveLength(1);

    await first.deferStateTarget(5, new Date(), firstTargets[0]!.claimedUntil);

    expect(scheduledAt).toEqual(recovered[0]!.claimedUntil);
  });

  it.each([new Date(now.getTime() + 900_000), null])(
    'preserves a newer API deadline or stop decision: %s',
    async (apiDeadline) => {
      const store = createLaunchStore(configuration);
      const targets = await store.dueStateTargets(now, 1);
      const claim = targets[0]!.claimedUntil;

      scheduledAt = apiDeadline;

      await store.refreshState(5, { sold: '100' }, 100, new Date(now.getTime() + 910_000), claim);

      await store.deferStateTarget(5, new Date(now.getTime() + 30_000), claim);

      expect(scheduledAt).toEqual(apiDeadline);

      expect(Launch.updateOne).toHaveBeenNthCalledWith(
        1,
        {
          chain: 'stellar',
          network: 'testnet',
          factoryContractId: 'factory',
          factoryIndex: 5,
          stateAsOfLedger: { $lte: 100 },
          nextStatePollAt: claim,
        },
        expect.anything(),
      );
    },
  );

  it('persists the fifteen-minute schedule only for the current claim', async () => {
    const store = createLaunchStore(configuration);
    const targets = await store.dueStateTargets(now, 1);
    const next = new Date(now.getTime() + 900_000);

    await store.refreshState(5, { sold: '100' }, 100, next, targets[0]!.claimedUntil);

    expect(scheduledAt).toEqual(next);

    expect(await store.dueStateTargets(now, 2)).toHaveLength(0);
  });

  it('does not select a launch before its deadline or after polling has stopped', async () => {
    const store = createLaunchStore(configuration);

    scheduledAt = new Date(now.getTime() + 900_000);

    expect(await store.dueStateTargets(now, 2)).toHaveLength(0);

    scheduledAt = null;

    expect(await store.dueStateTargets(now, 2)).toHaveLength(0);

    scheduledAt = undefined;

    expect(await store.dueStateTargets(now, 2)).toHaveLength(1);
  });
});
