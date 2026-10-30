import { beforeEach, describe, expect, it, vi } from 'vitest';

import Launch from '../../../src/models/Launch';
import TokenImage from '../../../src/models/TokenImage';
import finalizeTokenImages from '../../../src/services/tokenImage/finalizeTokenImages';

vi.mock('../../../src/logger', () => ({ default: { info: vi.fn(), warn: vi.fn() } }));

vi.mock('../../../src/models/Launch', () => ({
  default: { findOne: vi.fn(), updateOne: vi.fn() },
}));

vi.mock('../../../src/models/TokenImage', () => ({
  default: { find: vi.fn(), updateOne: vi.fn() },
}));

const configuration = { network: 'testnet' } as Parameters<typeof finalizeTokenImages>[0];

const image = {
  _id: 'image1',
  ownerAddress: 'GWALLET',
  publicUrl: 'https://images.example/tokens/testnet/1.png',
};

describe('token image finalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(TokenImage.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([image]),
    } as never);
  });

  it('links only a confirmed launch with the same network, owner and image URL', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ contractId: 'CLAUNCH', asset: 'CASSET' }),
    } as never);

    await finalizeTokenImages(configuration);

    expect(Launch.updateOne).not.toHaveBeenCalled();

    expect(Launch.findOne).toHaveBeenCalledWith({
      chain: 'stellar',
      network: 'testnet',
      owner: image.ownerAddress,
      'metadata.logo': image.publicUrl,
    });

    expect(TokenImage.updateOne).toHaveBeenCalledWith(
      { _id: image._id, status: { $in: ['pending', 'cleanup_ready'] } },
      {
        $set: expect.objectContaining({
          status: 'finalized',
          launchContractId: 'CLAUNCH',
          assetContractId: 'CASSET',
        }),
      },
    );
  });

  it('copies the server description and optional prelaunch links to the confirmed launch before finalizing', async () => {
    vi.mocked(TokenImage.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([
        {
          ...image,
          description: 'Full server description',
          website: 'https://project.example',
          xAccount: 'https://x.com/project',
        },
      ]),
    } as never);

    vi.mocked(Launch.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ contractId: 'CLAUNCH', asset: 'CASSET' }),
    } as never);

    await finalizeTokenImages(configuration);

    expect(Launch.updateOne).toHaveBeenCalledWith(
      { chain: 'stellar', network: 'testnet', contractId: 'CLAUNCH' },
      {
        $set: {
          'metadata.description': 'Full server description',
          'metadata.website': 'https://project.example',
          'metadata.xAccount': 'https://x.com/project',
        },
      },
    );

    expect(vi.mocked(Launch.updateOne).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(TokenImage.updateOne).mock.invocationCallOrder[0]!,
    );
  });

  it('keeps an unmatched upload pending', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    } as never);

    await finalizeTokenImages(configuration);

    expect(TokenImage.updateOne).not.toHaveBeenCalled();
  });

  it('keeps processing images when another image already owns the token', async () => {
    vi.mocked(TokenImage.find).mockReturnValue({
      lean: vi.fn().mockResolvedValue([image, { ...image, _id: 'image2' }]),
    } as never);

    vi.mocked(Launch.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ contractId: 'CLAUNCH', asset: 'CASSET' }),
    } as never);

    vi.mocked(TokenImage.updateOne)
      .mockRejectedValueOnce({ code: 11000 })
      .mockResolvedValueOnce({ modifiedCount: 1 } as never);

    await finalizeTokenImages(configuration);

    expect(TokenImage.updateOne).toHaveBeenCalledTimes(2);
  });

  it('propagates database outages for retry instead of hiding them as ownership conflicts', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ contractId: 'CLAUNCH', asset: 'CASSET' }),
    } as never);

    vi.mocked(TokenImage.updateOne).mockRejectedValueOnce(new Error('Database unavailable'));

    await expect(finalizeTokenImages(configuration)).rejects.toThrow('Database unavailable');
  });
});
