import { beforeEach, describe, expect, it, vi } from 'vitest';

import log from '../../../src/logger';
import LaunchHolder from '../../../src/models/LaunchHolder';
import refreshLaunchHolder from '../../../src/services/launch/refreshLaunchHolder';

vi.mock('../../../src/models/LaunchHolder', () => ({
  default: { findOne: vi.fn(), updateOne: vi.fn(), deleteOne: vi.fn() },
}));

vi.mock('../../../src/logger', () => ({ default: { info: vi.fn() } }));

const identity = { chain: 'stellar', network: 'testnet' as const, contractId: 'launch' };
const reader = { network: 'testnet' as const, tokenBalance: vi.fn() };

describe('launch worker holder balances', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(LaunchHolder.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as never);
  });

  it('does not log a holder observation when its balance is unchanged', async (): Promise<void> => {
    reader.tokenBalance.mockResolvedValue(7n);

    vi.mocked(LaunchHolder.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ balance: '7' }),
    } as never);

    await refreshLaunchHolder(reader, identity, 'token', 'wallet');

    expect(log.info).not.toHaveBeenCalled();
  });

  it('stores the exact token contract balance rather than computing trade deltas', async () => {
    reader.tokenBalance
      .mockResolvedValueOnce(9007199254740993n)
      .mockResolvedValueOnce(7n)
      .mockResolvedValueOnce(7n);

    await refreshLaunchHolder(reader, identity, 'token', 'wallet');

    await refreshLaunchHolder(reader, identity, 'token', 'wallet');

    await refreshLaunchHolder(reader, identity, 'token', 'wallet');

    expect(reader.tokenBalance).toHaveBeenCalledWith('token', 'wallet');

    expect(vi.mocked(LaunchHolder.updateOne).mock.calls.map((call) => call[1])).toEqual([
      { $set: expect.objectContaining({ balance: '9007199254740993' }) },
      { $set: expect.objectContaining({ balance: '7' }) },
      { $set: expect.objectContaining({ balance: '7' }) },
    ]);
  });

  it('removes a wallet whose actual token balance is zero', async () => {
    reader.tokenBalance.mockResolvedValue(0n);

    await refreshLaunchHolder(reader, identity, 'token', 'wallet');

    expect(LaunchHolder.deleteOne).toHaveBeenCalledWith({ ...identity, address: 'wallet' });

    expect(LaunchHolder.updateOne).not.toHaveBeenCalled();
  });

  it('preserves the snapshot on RPC failures or invalid balances', async () => {
    reader.tokenBalance.mockRejectedValueOnce(new Error('RPC down')).mockResolvedValueOnce(-1n);

    await expect(refreshLaunchHolder(reader, identity, 'token', 'wallet')).rejects.toThrow(
      'RPC down',
    );

    await expect(refreshLaunchHolder(reader, identity, 'token', 'wallet')).rejects.toThrow(
      'Invalid token balance',
    );

    expect(LaunchHolder.updateOne).not.toHaveBeenCalled();

    expect(LaunchHolder.deleteOne).not.toHaveBeenCalled();
  });
});
