import { beforeEach, describe, expect, it, vi } from 'vitest';

import LaunchPriceSample from '../../../src/models/LaunchPriceSample';
import recordLaunchPrice from '../../../src/services/launch/recordLaunchPrice';

vi.mock('../../../src/logger', () => ({ default: { info: vi.fn() } }));

vi.mock('../../../src/models/LaunchPriceSample', () => ({
  default: { findOne: vi.fn(), updateOne: vi.fn(), exists: vi.fn() },
}));
const identity = { network: 'testnet' as const, contractId: 'curve' };
describe('direct contract price observations', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(LaunchPriceSample.findOne).mockReturnValue({
      sort: () => ({ lean: async () => null }),
    } as never);
  });
  it('stores exact returned prices and preserves multiple observations in a minute', async () => {
    const first = new Date('2026-10-11T00:01:35Z');
    const second = new Date('2026-10-11T00:01:40Z');
    await recordLaunchPrice(identity, { value: 9007199254740993n, ledger: 100 }, first);
    await recordLaunchPrice(identity, { value: 9007199254740994n, ledger: 101 }, second);
    expect(LaunchPriceSample.updateOne).toHaveBeenNthCalledWith(
      1,
      { ...identity, observationKey: '100' },
      {
        $setOnInsert: expect.objectContaining({
          sampledAt: first,
          ledger: 100,
          price: '9007199254740993',
        }),
      },
      { upsert: true },
    );
    expect(LaunchPriceSample.updateOne).toHaveBeenNthCalledWith(
      2,
      { ...identity, observationKey: '101' },
      expect.anything(),
      {
        upsert: true,
      },
    );
  });
  it('skips unchanged prices and older or already sampled ledgers', async () => {
    vi.mocked(LaunchPriceSample.findOne).mockReturnValue({
      sort: () => ({ lean: async () => ({ price: '100', ledger: 10 }) }),
    } as never);
    await recordLaunchPrice(identity, { value: 100n, ledger: 11 });
    await recordLaunchPrice(identity, { value: 200n, ledger: 9 });
    await recordLaunchPrice(identity, { value: 200n, ledger: 10 });
    expect(LaunchPriceSample.updateOne).not.toHaveBeenCalled();
  });
  it('rejects invalid prices and propagates failures for retry', async () => {
    await expect(recordLaunchPrice(identity, { value: 0n, ledger: 1 })).rejects.toThrow();
    expect(LaunchPriceSample.updateOne).not.toHaveBeenCalled();
    vi.mocked(LaunchPriceSample.updateOne).mockRejectedValue(new Error('storage down'));
    await expect(recordLaunchPrice(identity, { value: 1n, ledger: 1 })).rejects.toThrow(
      'storage down',
    );
  });
});
