import { beforeEach, describe, expect, it, vi } from 'vitest';

import Launch from '../../../src/models/Launch';
import LaunchName from '../../../src/models/LaunchName';
import TokenImage from '../../../src/models/TokenImage';
import type { LaunchData } from '../../../src/types/launch/model';
import claimLaunchName from '../../../src/services/launch/claimLaunchName';

vi.mock('../../../src/models/Launch', () => ({ default: { findOne: vi.fn() } }));
vi.mock('../../../src/models/LaunchName', () => ({ default: { findOneAndUpdate: vi.fn() } }));
vi.mock('../../../src/models/TokenImage', () => ({ default: { findOne: vi.fn() } }));

const launch = {
  network: 'testnet',
  contractId: 'contract-one',
  owner: 'owner',
  metadata: { name: 'Blue Man', logo: 'https://images.example/logo.png' },
} as LaunchData;

describe('launch name claims', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(Launch.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    } as never);

    vi.mocked(TokenImage.findOne).mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);
    vi.mocked(LaunchName.findOneAndUpdate).mockResolvedValue({} as never);
  });

  it('uses one atomic claim for direct launches, matching reservations and repeated indexing', async () => {
    await expect(claimLaunchName(launch)).resolves.toBe('blue-man');

    expect(LaunchName.findOneAndUpdate).toHaveBeenCalledWith(
      {
        network: 'testnet',
        slug: 'blue-man',
        ownerAddress: 'owner',
        publicUrl: 'https://images.example/logo.png',
        $or: [
          { status: 'reserved', contractId: null },
          { status: 'indexed', contractId: 'contract-one' },
        ],
      },
      expect.objectContaining({ $set: { status: 'indexed', contractId: 'contract-one' } }),
      { upsert: true },
    );
  });

  it('marks duplicate names as conflicts without hiding infrastructure failures', async () => {
    vi.mocked(LaunchName.findOneAndUpdate).mockRejectedValueOnce({ code: 11000 });

    await expect(claimLaunchName(launch)).rejects.toMatchObject({ name: 'LaunchNameConflict' });

    const unavailable = new Error('Database unavailable');

    vi.mocked(LaunchName.findOneAndUpdate).mockRejectedValueOnce(unavailable);

    await expect(claimLaunchName(launch)).rejects.toBe(unavailable);
  });

  it.each([
    { slug: 'other-project', status: 'pending' },
    { slug: 'blue-man', status: 'expired' },
  ])('rejects a mismatched or released prelaunch: %j', async (image) => {
    vi.mocked(TokenImage.findOne).mockReturnValue({ lean: vi.fn().mockResolvedValue(image) } as never);

    await expect(claimLaunchName(launch)).rejects.toMatchObject({ name: 'LaunchNameConflict' });

    expect(LaunchName.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('can recover an indexed claim while cleanup is waiting for the launch record', async () => {
    vi.mocked(TokenImage.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ slug: 'blue-man', status: 'deleting' }),
    } as never);

    await expect(claimLaunchName(launch)).resolves.toBe('blue-man');

    expect(LaunchName.findOneAndUpdate).toHaveBeenCalledOnce();
  });

  it('preserves a migrated legacy slug during reconciliation', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ slug: 'blue-man-legacy' }) }),
    } as never);

    await expect(claimLaunchName(launch)).resolves.toBe('blue-man-legacy');

    expect(LaunchName.findOneAndUpdate).not.toHaveBeenCalled();
    expect(TokenImage.findOne).not.toHaveBeenCalled();
  });

});
