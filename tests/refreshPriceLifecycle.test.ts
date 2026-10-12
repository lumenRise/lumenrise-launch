import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LaunchReader } from '../src/types/launch';
import recordLaunchPrice from '../src/recordLaunchPrice';
import type { LaunchStore, StateTarget } from '../src/types/launch';
import refreshLaunchState from '../src/refreshLaunchState';

vi.mock('../src/recordLaunchPrice', () => ({ default: vi.fn() }));
const now = new Date('2026-10-12T00:00:00Z');
const seconds = Math.floor(now.getTime() / 1000);
const target: StateTarget = {
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
    reader.launchState.mockResolvedValue({ value: state, ledger: 100 });
    reader.launchPrice.mockResolvedValue({ value: 10000000n, ledger: 101 });
    store.dueStateTargets.mockResolvedValue([target]);
  });
  it('samples an active launch and schedules the next state/price check in 10 minutes', async () => {
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
      new Date(now.getTime() + 600000),
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
      new Date(now.getTime() + 600000),
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
      new Date(now.getTime() + 600000),
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
    expect(store.refreshState).toHaveBeenCalledWith(1, expect.anything(), 100, null);
  });
  it('retries a price failure without advancing the normal poll schedule', async () => {
    reader.launchPrice.mockRejectedValue(new Error('RPC down'));
    await refresh();
    expect(store.refreshState).not.toHaveBeenCalled();
    expect(store.deferStateTarget).toHaveBeenCalledWith(1, new Date(now.getTime() + 30000));
  });
  it('rejects a price response older than the observed state', async () => {
    reader.launchPrice.mockResolvedValue({ value: 10000000n, ledger: 99 });
    await refresh();
    expect(recordLaunchPrice).not.toHaveBeenCalled();
    expect(store.deferStateTarget).toHaveBeenCalled();
  });
});
