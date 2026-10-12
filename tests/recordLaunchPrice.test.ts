import { beforeEach, describe, expect, it, vi } from 'vitest';

import LaunchPriceSample from '../src/store/LaunchPriceSample';
import recordLaunchPrice from '../src/recordLaunchPrice';

vi.mock('../src/store/LaunchPriceSample', () => ({ default: { updateOne: vi.fn() } }));
const identity = { network: 'testnet' as const, contractId: 'curve' };
describe('direct contract price observations', () => {
  beforeEach(() => vi.resetAllMocks());
  it('stores exact returned prices and preserves multiple observations in a minute', async () => {
    const first = new Date('2026-10-11T00:01:35Z');
    const second = new Date('2026-10-11T00:01:40Z');
    await recordLaunchPrice(identity, { value: 9007199254740993n, ledger: 100 }, first);
    await recordLaunchPrice(identity, { value: 9007199254740994n, ledger: 101 }, second);
    expect(LaunchPriceSample.updateOne).toHaveBeenNthCalledWith(
      1,
      { ...identity, bucket: first },
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
      { ...identity, bucket: second },
      expect.anything(),
      {
        upsert: true,
      },
    );
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
