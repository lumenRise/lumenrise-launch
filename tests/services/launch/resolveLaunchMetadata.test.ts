import { beforeEach, describe, expect, it, vi } from 'vitest';

import TokenImage from '../../../src/models/TokenImage';
import type { LaunchData } from '../../../src/types/launch/model';
import resolveLaunchMetadata from '../../../src/services/launch/resolveLaunchMetadata';

vi.mock('../../../src/models/TokenImage', () => ({ default: { findOne: vi.fn() } }));

const launch = {
  network: 'testnet',
  owner: 'owner',
  metadata: {
    name: 'Project',
    description: 'Untrusted contract description',
    logo: 'https://images.example/logo.png',
    symbol: 'PRJ',
  },
} as LaunchData;

describe('server launch metadata', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('uses the server description and links before inserting the launch', async () => {
    vi.mocked(TokenImage.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        description: 'Full server description',
        website: 'https://project.example',
        xAccount: 'https://x.com/project',
      }),
    } as never);

    await expect(resolveLaunchMetadata(launch)).resolves.toEqual({
      ...launch.metadata,
      description: 'Full server description',
      website: 'https://project.example',
      xAccount: 'https://x.com/project',
    });

    expect(TokenImage.findOne).toHaveBeenCalledWith({
      chain: 'stellar',
      network: 'testnet',
      ownerAddress: 'owner',
      publicUrl: launch.metadata.logo,
      status: { $ne: 'expired' },
    });
  });

  it.each([null, {}])(
    'does not fall back to the contract description without server text: %j',
    async (image) => {
      vi.mocked(TokenImage.findOne).mockReturnValue({
        lean: vi.fn().mockResolvedValue(image),
      } as never);

      await expect(resolveLaunchMetadata(launch)).resolves.toEqual({
        ...launch.metadata,
        description: '',
      });
    },
  );
});
