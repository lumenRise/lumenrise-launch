import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LaunchReader } from '../../../src/types/launch/reader';
import recordLaunchPrice from '../../../src/services/launch/recordLaunchPrice';
import refreshLaunchState from '../../../src/services/launch/refreshLaunchState';
import type { LaunchStore, ClaimedStateTarget } from '../../../src/types/launch/store';

vi.mock('../../../src/logger', () => ({ default: { info: vi.fn() } }));

vi.mock('../../../src/services/launch/recordLaunchPrice', () => ({ default: vi.fn() }));
const now = new Date('2026-10-12T00:00:00Z');
const seconds = Math.floor(now.getTime() / 1000);
const target: ClaimedStateTarget = {
  claimedUntil: new Date(now.getTime() + 120_000),
  factoryIndex: 1,
  contractId: 'curve',
  startsAt: String(seconds - 60),
  endsAt: String(seconds + 60),
  graduated: false,
  sold: '100',
};
const state = {
  sold: 100n,
  quote_reserve: 100n,
  team_claimed: 0n,
  buyer_count: 1,
  graduated: false,
};
const reader = { network: 'testnet', launchState: vi.fn(), launchPrice: vi.fn() };
const store = { dueStateTargets: vi.fn(), refreshState: vi.fn(), deferStateTarget: vi.fn() };
const refresh = () =>
  refreshLaunchState(reader as unknown as LaunchReader, store as unknown as LaunchStore, now);

describe('contract price polling lifecycle', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(now);
    reader.launchState.mockResolvedValue({ value: state, ledger: 100 });
    reader.launchPrice.mockResolvedValue({ value: 10000000n, ledger: 101 });
    store.dueStateTargets.mockResolvedValue([target]);
    store.refreshState.mockResolvedValue(true);
  });
  afterEach(() => vi.useRealTimers());

  it('does not report an old poll as refreshed when a newer trade owns its schedule', async () => {
    store.refreshState.mockResolvedValue(false);

    expect(await refresh()).toBe(0);
    expect(store.deferStateTarget).not.toHaveBeenCalled();
  });

  it('schedules from the completed read rather than from the start of a slow batch', async () => {
    reader.launchPrice.mockImplementation(async () => {
      vi.setSystemTime(new Date(now.getTime() + 40_000));

      return { value: 10000000n, ledger: 101 };
    });

    await refresh();

    expect(store.refreshState).toHaveBeenCalledWith(
      1,
      expect.anything(),
      100,
      new Date(now.getTime() + 940_000),
      target.claimedUntil,
    );
  });

  it('waits a full retry interval after a slow failure', async () => {
    reader.launchPrice.mockImplementation(async () => {
      vi.setSystemTime(new Date(now.getTime() + 40_000));

      throw new Error('RPC timeout');
    });

    await refresh();

    expect(store.deferStateTarget).toHaveBeenCalledWith(
      1,
      new Date(now.getTime() + 70_000),
      target.claimedUntil,
    );
  });

  it('sleeps until a future launch opens instead of reading it every 15 minutes', async () => {
    store.dueStateTargets.mockResolvedValue([{ ...target, startsAt: String(seconds + 86_400) }]);

    await refresh();

    expect(reader.launchPrice).not.toHaveBeenCalled();

    expect(store.refreshState).toHaveBeenCalledWith(
      1,
      expect.anything(),
      100,
      new Date(now.getTime() + 86_400_000),
      target.claimedUntil,
    );
  });

  it('seeds an active launch and schedules the next state check in 15 minutes', async () => {
    await refresh();
    expect(reader.launchPrice).toHaveBeenCalledWith('curve');
    expect(recordLaunchPrice).toHaveBeenCalledWith(
      { network: 'testnet', contractId: 'curve' },
      { value: 10000000n, ledger: 101 },
    );
    expect(store.refreshState).toHaveBeenCalledWith(
      1,
      expect.anything(),
      100,
      new Date(now.getTime() + 900000),
      target.claimedUntil,
    );
  });
  it('reads and records a fresh price on every due poll', async () => {
    await refresh();

    reader.launchPrice.mockResolvedValue({ value: 12000000n, ledger: 201 });

    vi.setSystemTime(new Date(now.getTime() + 900000));

    await refreshLaunchState(
      reader as unknown as LaunchReader,
      store as unknown as LaunchStore,
      new Date(now.getTime() + 900000),
      target.claimedUntil,
    );

    expect(reader.launchPrice).toHaveBeenCalledTimes(2);

    expect(recordLaunchPrice).toHaveBeenLastCalledWith(
      { network: 'testnet', contractId: 'curve' },
      { value: 12000000n, ledger: 201 },
    );

    expect(store.refreshState).toHaveBeenLastCalledWith(
      1,
      expect.anything(),
      100,
      new Date(now.getTime() + 1800000),
      target.claimedUntil,
    );
  });
  it('seeds a newly indexed already graduated launch before stopping', async () => {
    store.dueStateTargets.mockResolvedValue([{ ...target, graduated: true }]);
    reader.launchState.mockResolvedValue({ value: { ...state, graduated: true }, ledger: 100 });
    await refresh();
    expect(recordLaunchPrice).toHaveBeenCalledTimes(1);
    expect(store.refreshState).toHaveBeenCalledWith(
      1,
      expect.anything(),
      100,
      null,
      target.claimedUntil,
    );
  });
  it('waits until opening before the initial price sample', async () => {
    store.dueStateTargets.mockResolvedValue([{ ...target, startsAt: String(seconds + 60) }]);
    await refresh();
    expect(reader.launchPrice).not.toHaveBeenCalled();
    expect(store.refreshState).toHaveBeenCalledWith(
      1,
      expect.anything(),
      100,
      new Date(now.getTime() + 60000),
      target.claimedUntil,
    );
  });
  it('continues sampling a failed launch with tokens still sellable', async () => {
    store.dueStateTargets.mockResolvedValue([{ ...target, endsAt: String(seconds - 60) }]);
    await refresh();
    expect(reader.launchPrice).toHaveBeenCalledTimes(1);
    expect(store.refreshState).toHaveBeenCalledWith(
      1,
      expect.anything(),
      100,
      new Date(now.getTime() + 900000),
      target.claimedUntil,
    );
  });
  it('uses fresh state when a cached empty launch has since received trades', async () => {
    store.dueStateTargets.mockResolvedValue([
      { ...target, sold: '0', endsAt: String(seconds - 60) },
    ]);
    await refresh();
    expect(recordLaunchPrice).toHaveBeenCalledTimes(1);
    expect(store.refreshState).toHaveBeenCalledWith(
      1,
      expect.anything(),
      100,
      new Date(now.getTime() + 900000),
      target.claimedUntil,
    );
  });
  it.each([
    { sold: 0n, graduated: false },
    { sold: 100n, graduated: true },
  ])('records a final sample and stops on a terminal state', async (terminal) => {
    store.dueStateTargets.mockResolvedValue([{ ...target, endsAt: String(seconds - 60) }]);
    reader.launchState.mockResolvedValue({ value: { ...state, ...terminal }, ledger: 100 });
    await refresh();
    expect(recordLaunchPrice).toHaveBeenCalledTimes(1);
    expect(store.refreshState).toHaveBeenCalledWith(
      1,
      expect.anything(),
      100,
      null,
      target.claimedUntil,
    );
  });
  it('retries a price failure without advancing the normal poll schedule', async () => {
    reader.launchPrice.mockRejectedValue(new Error('RPC down'));
    await refresh();
    expect(store.refreshState).not.toHaveBeenCalled();
    expect(store.deferStateTarget).toHaveBeenCalledWith(
      1,
      new Date(now.getTime() + 30000),
      target.claimedUntil,
    );
  });
  it('rejects a price response older than the observed state', async () => {
    reader.launchPrice.mockResolvedValue({ value: 10000000n, ledger: 99 });
    await refresh();
    expect(recordLaunchPrice).not.toHaveBeenCalled();
    expect(store.deferStateTarget).toHaveBeenCalled();
  });
});
