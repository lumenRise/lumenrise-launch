import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import Launch from '../../src/models/Launch';
import LaunchName from '../../src/models/LaunchName';
import TokenImage from '../../src/models/TokenImage';
import readBaseLaunch from '../../src/services/base/readBaseLaunch';
import type { BaseEventContext } from '../../src/types/base/launch';
import createBaseCreationLog from '../helpers/createBaseCreationLog';
import indexBaseLaunch from '../../src/services/base/indexBaseLaunch';

vi.mock('../../src/services/base/readBaseLaunch', () => ({ default: vi.fn() }));

const address = '0x1111111111111111111111111111111111111111';
const owner = '0x2222222222222222222222222222222222222222';
const imageId = '507f1f77bcf86cd799439011';
const logo = 'https://images.example/launch.png';

const context = {
  session: {},
  configuration: {
    network: 'testnet',
    factoryAddress: '0x3333333333333333333333333333333333333333',
  },
  client: { readContract: vi.fn() },
} as unknown as BaseEventContext;

beforeEach((): void => {
  vi.clearAllMocks();

  vi.mocked(context.client.readContract).mockResolvedValue(address);

  vi.mocked(readBaseLaunch).mockResolvedValue({
    config: {
      total_supply: 1_000_000n * 10n ** 18n,
      params: {
        owner,
        asset: '0x4444444444444444444444444444444444444444',
        pair: '0x5555555555555555555555555555555555555555',
        metadata: {
          name: 'Blue Project',
          symbol: 'BLUE',
          description: 'On-chain description',
          logo,
        },
      },
    },
    plainConfig: {},
    state: { sold: '0' },
    price: 1n,
    assetDecimals: 18,
    pairDecimals: 6,
  } as never);

  vi.spyOn(LaunchName, 'findOne').mockReturnValue({
    session: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ prelaunchId: imageId }) }),
  } as never);

  vi.spyOn(LaunchName, 'findOneAndUpdate').mockResolvedValue({} as never);

  vi.spyOn(Launch, 'updateOne').mockResolvedValue({} as never);

  vi.spyOn(TokenImage, 'updateOne').mockResolvedValue({} as never);

  vi.spyOn(TokenImage, 'findOne').mockReturnValue({
    session: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: imageId,
        slug: 'blue-project',
        status: 'pending',
        publicUrl: logo,
        description: 'Draft description',
      }),
    }),
  } as never);
});

afterEach((): void => {
  vi.restoreAllMocks();
});

it('matches prelaunch by explicit reference, chain, network and owner address', async (): Promise<void> => {
  await indexBaseLaunch(context, createBaseCreationLog(), 100n);

  expect(TokenImage.findOne).toHaveBeenCalledWith({
    _id: imageId,
    chain: 'base',
    network: 'testnet',
    ownerAddress: owner,
    slug: 'blue-project',
  });

  expect(Launch.updateOne).toHaveBeenCalledWith(
    { chain: 'base', network: 'testnet', contractId: address },
    expect.objectContaining({
      $setOnInsert: expect.objectContaining({
        prelaunchId: imageId,
        owner,
        metadata: expect.objectContaining({ description: 'Draft description' }),
      }),
    }),
    expect.objectContaining({ session: context.session }),
  );

  expect(TokenImage.updateOne).toHaveBeenCalledWith(
    { _id: imageId },
    expect.objectContaining({
      $set: expect.objectContaining({ status: 'finalized', launchContractId: address }),
    }),
    { session: context.session },
  );
});

it('indexes valid external launches without requiring an API prelaunch', async (): Promise<void> => {
  vi.mocked(LaunchName.findOne).mockReturnValue({
    session: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  } as never);

  await indexBaseLaunch(context, createBaseCreationLog(), 100n);

  expect(TokenImage.findOne).not.toHaveBeenCalled();

  expect(Launch.updateOne).toHaveBeenCalled();
});

it('rejects an unrelated draft or a launch outside the factory registry', async (): Promise<void> => {
  vi.mocked(TokenImage.findOne).mockReturnValue({
    session: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  } as never);

  await expect(indexBaseLaunch(context, createBaseCreationLog(), 100n)).rejects.toThrow(
    'prelaunch reference',
  );

  expect(Launch.updateOne).not.toHaveBeenCalled();

  vi.mocked(context.client.readContract).mockResolvedValue(
    '0x6666666666666666666666666666666666666666',
  );

  await expect(indexBaseLaunch(context, createBaseCreationLog(), 100n)).rejects.toThrow(
    'not registered',
  );
});
