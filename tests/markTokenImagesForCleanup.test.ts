import { beforeEach, describe, expect, it, vi } from 'vitest';

import Launch from '../src/store/Launch';
import TokenImage from '../src/store/TokenImage';
import markTokenImagesForCleanup from '../src/markTokenImagesForCleanup';

vi.mock('../src/store/Launch', () => ({ default: { exists: vi.fn() } }));
vi.mock('../src/store/TokenImage', () => ({ default: { find: vi.fn(), updateOne: vi.fn() } }));

const configuration = { network: 'testnet' } as Parameters<typeof markTokenImagesForCleanup>[0];
const now = new Date('2026-10-10T00:00:00.000Z');
const image = { _id: 'image1', ownerAddress: 'GWALLET', publicUrl: 'https://images.example/1.png' };

describe('token image cleanup nomination', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TokenImage.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([image]) }) }),
    } as never);
    vi.mocked(TokenImage.updateOne).mockResolvedValue({ modifiedCount: 1 } as never);
  });

  it('marks only old unreferenced uploads and waits another day before deletion', async () => {
    vi.mocked(Launch.exists).mockResolvedValue(null);
    expect(await markTokenImagesForCleanup(configuration, now)).toBe(1);
    expect(TokenImage.find).toHaveBeenCalledWith({
      network: 'testnet', status: 'pending', createdAt: { $lte: new Date('2026-10-03T00:00:00.000Z') },
    });
    expect(TokenImage.updateOne).toHaveBeenCalledWith(
      { _id: image._id, status: 'pending' },
      { $set: { status: 'cleanup_ready', cleanupReadyAt: now, cleanupNextAt: new Date('2026-10-11T00:00:00.000Z') } },
    );
  });

  it('never nominates an image used by an indexed launch', async () => {
    vi.mocked(Launch.exists).mockResolvedValue({ _id: 'launch1' } as never);
    expect(await markTokenImagesForCleanup(configuration, now)).toBe(0);
    expect(TokenImage.updateOne).not.toHaveBeenCalled();
  });
});
