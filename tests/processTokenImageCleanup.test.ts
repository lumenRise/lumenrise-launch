import { beforeEach, describe, expect, it, vi } from 'vitest';

import Launch from '../src/models/Launch';
import LaunchName from '../src/models/LaunchName';
import TokenImage from '../src/models/TokenImage';
import deleteTokenImageObject from '../src/services/tokenImage/deleteTokenImageObject';
import processTokenImageCleanup from '../src/services/tokenImage/processTokenImageCleanup';

vi.mock('../src/models/LaunchName', () => ({ default: { updateOne: vi.fn(), exists: vi.fn() } }));

vi.mock('../src/models/Launch', () => ({ default: { findOne: vi.fn() } }));

vi.mock('../src/models/TokenImage', () => ({
  default: { find: vi.fn(), findOneAndUpdate: vi.fn(), updateOne: vi.fn() },
}));

vi.mock('../src/services/tokenImage/deleteTokenImageObject', () => ({ default: vi.fn() }));

const now = new Date('2026-10-10T00:00:00.000Z');

const image = {
  _id: 'image1',
  network: 'testnet',
  ownerAddress: 'GWALLET',
  publicUrl: 'https://images.example/1.png',
  objectKey: 'tokens/testnet/1.png',
  status: 'cleanup_ready',
  cleanupAttempts: 0,
};

describe('token image cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(TokenImage.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([image]) }),
      }),
    } as never);

    vi.mocked(TokenImage.findOneAndUpdate).mockReturnValue({
      lean: vi.fn().mockResolvedValue(image),
    } as never);
  });

  it('keeps the image if an indexed launch appeared during the grace period', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ contractId: 'CLAUNCH', asset: 'CASSET' }),
      }),
    } as never);

    await processTokenImageCleanup(now);

    expect(deleteTokenImageObject).not.toHaveBeenCalled();

    expect(TokenImage.updateOne).toHaveBeenCalledWith(
      { _id: image._id, status: 'deleting' },
      { $set: expect.objectContaining({ status: 'finalized', launchContractId: 'CLAUNCH' }) },
    );
  });

  it('deletes only an unreferenced image after an atomic claim', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    } as never);

    await processTokenImageCleanup(now);

    expect(TokenImage.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: image._id,
        status: { $in: ['cleanup_ready', 'deleting'] },
        cleanupNextAt: { $lte: now },
      },
      { $set: { status: 'deleting', cleanupNextAt: new Date('2026-10-10T00:15:00.000Z') } },
      { new: true },
    );

    expect(deleteTokenImageObject).toHaveBeenCalledWith(image.objectKey);

    expect(TokenImage.updateOne).toHaveBeenCalledWith(
      { _id: image._id, status: 'deleting' },
      { $set: { status: 'expired', expiredAt: now, cleanupNextAt: null } },
    );
  });

  it('keeps the object eligible for retry when storage deletion fails', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    } as never);

    vi.mocked(deleteTokenImageObject).mockRejectedValueOnce(new Error('R2 unavailable'));

    await processTokenImageCleanup(now);

    expect(TokenImage.updateOne).toHaveBeenCalledWith(
      { _id: image._id, status: 'deleting' },
      { $set: { cleanupAttempts: 1, cleanupNextAt: new Date('2026-10-10T00:02:00.000Z') } },
    );

    expect(TokenImage.updateOne).not.toHaveBeenCalledWith(expect.anything(), {
      $set: expect.objectContaining({ status: 'expired' }),
    });
  });

  it('releases an unused reserved name before removing its image', async () => {
    const reserved = { ...image, slug: 'blue-man' };

    vi.mocked(TokenImage.findOneAndUpdate).mockReturnValue({
      lean: vi.fn().mockResolvedValue(reserved),
    } as never);

    vi.mocked(Launch.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    } as never);

    vi.mocked(LaunchName.updateOne).mockResolvedValue({ modifiedCount: 1 } as never);

    vi.mocked(deleteTokenImageObject).mockResolvedValue(undefined);

    await processTokenImageCleanup(now);

    expect(LaunchName.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        network: 'testnet',
        slug: 'blue-man',
        contractId: null,
        status: 'reserved',
      }),
      { $set: { status: 'expired' } },
    );

    expect(deleteTokenImageObject).toHaveBeenCalledWith(image.objectKey);
  });

  it('keeps an image when a worker claimed its name during cleanup', async () => {
    vi.mocked(TokenImage.findOneAndUpdate).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ...image, slug: 'blue-man' }),
    } as never);

    vi.mocked(Launch.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
    } as never);

    vi.mocked(LaunchName.updateOne).mockResolvedValue({ modifiedCount: 0 } as never);

    vi.mocked(LaunchName.exists).mockResolvedValue({ _id: 'claim' } as never);

    await processTokenImageCleanup(now);

    expect(deleteTokenImageObject).not.toHaveBeenCalled();
  });
});
