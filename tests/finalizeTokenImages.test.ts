import { beforeEach, describe, expect, it, vi } from 'vitest';

import Launch from '../src/store/Launch';
import TokenImage from '../src/store/TokenImage';
import finalizeTokenImages from '../src/finalizeTokenImages';

vi.mock('../src/store/Launch', () => ({ default: { findOne: vi.fn() } }));
vi.mock('../src/store/TokenImage', () => ({ default: { find: vi.fn(), updateOne: vi.fn() } }));

const configuration = { network: 'testnet' } as Parameters<typeof finalizeTokenImages>[0];
const image = { _id: 'image1', ownerAddress: 'GWALLET', publicUrl: 'https://images.example/tokens/testnet/1.png' };

describe('token image finalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(TokenImage.find).mockReturnValue({ lean: vi.fn().mockResolvedValue([image]) } as never);
  });

  it('links only a confirmed launch with the same network, owner and image URL', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({ lean: vi.fn().mockResolvedValue({ contractId: 'CLAUNCH', asset: 'CASSET' }) } as never);

    await finalizeTokenImages(configuration);

    expect(Launch.findOne).toHaveBeenCalledWith({
      network: 'testnet', owner: image.ownerAddress, 'metadata.logo': image.publicUrl,
    });
    expect(TokenImage.updateOne).toHaveBeenCalledWith(
      { _id: image._id, status: { $in: ['pending', 'cleanup_ready'] } },
      { $set: expect.objectContaining({ status: 'finalized', launchContractId: 'CLAUNCH', assetContractId: 'CASSET' }) },
    );
  });

  it('keeps an unmatched upload pending', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);

    await finalizeTokenImages(configuration);

    expect(TokenImage.updateOne).not.toHaveBeenCalled();
  });
});
