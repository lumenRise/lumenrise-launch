import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LaunchData } from '../src/types/launch';
import recordLaunchPrice from '../src/recordLaunchPrice';
import LaunchPriceSample from '../src/store/LaunchPriceSample';

vi.mock('../src/store/LaunchPriceSample', () => ({
  default: { updateOne: vi.fn() },
}));
const launch = {
  network: 'testnet',
  contractId: 'curve',
  stateObservedAt: new Date('2026-10-11T00:01:35Z'),
  stateAsOfLedger: 100,
  config: {
    params: {
      curve: {
        virtual_base_reserve: '3000000000',
        virtual_quote_reserve: '3000000000',
      },
    },
  },
  state: { sold: '1000000000' },
} as LaunchData;

describe('sampled curve prices', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });
  it('matches the contract marginal price and writes only one minute bucket', async () => {
    await recordLaunchPrice(launch);
    expect(LaunchPriceSample.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        bucket: new Date('2026-10-11T00:01:00Z'),
        ledger: { $lte: 100 },
      }),
      { $set: expect.objectContaining({ price: '22500000', ledger: 100 }) },
      { upsert: true },
    );
  });
  it('keeps a newer ledger sample but propagates storage failures for retry', async () => {
    vi.mocked(LaunchPriceSample.updateOne).mockRejectedValueOnce({
      code: 11000,
    });
    await expect(recordLaunchPrice(launch)).resolves.toBeUndefined();
    vi.mocked(LaunchPriceSample.updateOne).mockRejectedValueOnce(new Error('storage down'));
    await expect(recordLaunchPrice(launch)).rejects.toThrow('storage down');
  });
});
