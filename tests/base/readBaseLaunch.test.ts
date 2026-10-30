import { afterEach, expect, it, vi } from 'vitest';

import launchAbi from '../../src/constants/base/launchAbi';
import readBaseLaunch from '../../src/services/base/readBaseLaunch';
import type { BaseContext } from '../../src/types/base/configuration';

const address = '0x1111111111111111111111111111111111111111';
const factory = '0x3333333333333333333333333333333333333333';

const config = {
  factory,
  platform: '0x2222222222222222222222222222222222222222',
  platform_fee_bps: 100,
  params: {
    owner: '0x2222222222222222222222222222222222222222',
    asset: '0x4444444444444444444444444444444444444444',
    pair: '0x5555555555555555555555555555555555555555',
    metadata: {
      name: 'Blue Project',
      symbol: 'BLUE',
      logo: 'https://images.example/token.png',
      description: '',
    },
    allocations: { pool_bps: 2000, curve_bps: 7000, team_bps: 1000 },
    vesting: { cliff_seconds: 0n, duration_seconds: 0n, schedule: 0 },
    curve: {
      virtual_base_reserve: 10n ** 24n,
      virtual_quote_reserve: 10n ** 12n,
      graduation_target: 10n ** 10n,
      creator_fee_bps: 100,
      creator_payout_bps: 100,
    },
    starts_at: 100n,
  },
  total_supply: 10n ** 24n,
  buckets: { pool: 2n * 10n ** 23n, curve: 7n * 10n ** 23n, team: 10n ** 23n },
};

const state = {
  sold: 0n,
  quote_reserve: 0n,
  creator_fees: 0n,
  team_claimed: 0n,
  buyer_count: 0n,
  graduated: false,
  busy: false,
};
const readContract = vi.fn();

const context = {
  configuration: { network: 'testnet', factoryAddress: factory },
  client: { readContract },
} as unknown as BaseContext;

afterEach((): void => {
  vi.resetAllMocks();
});

it('reads 18-decimal assets with a 6-decimal pair using the deployed ABI', async (): Promise<void> => {
  readContract
    .mockResolvedValueOnce(config)
    .mockResolvedValueOnce(state)
    .mockResolvedValueOnce(1_000_000n)
    .mockResolvedValueOnce(18)
    .mockResolvedValueOnce(6);

  const result = await readBaseLaunch({ context, address, blockNumber: 20n });

  expect(result).toMatchObject({ assetDecimals: 18, pairDecimals: 6, price: 1_000_000n });
  expect(result.plainConfig.total_supply).toBe('1000000000000000000000000');
  expect(result.state).toMatchObject({ buyer_count: 0, busy: false, sold: '0' });
  expect(result.plainConfig).not.toHaveProperty('reputation');
  expect(readContract).toHaveBeenCalledWith({
    address,
    abi: launchAbi,
    functionName: 'get_config',
    blockNumber: 20n,
  });
});

it('rejects unsupported decimals before indexing market data', async (): Promise<void> => {
  readContract
    .mockResolvedValueOnce(config)
    .mockResolvedValueOnce(state)
    .mockResolvedValueOnce(1_000_000n)
    .mockResolvedValueOnce(19)
    .mockResolvedValueOnce(6);

  await expect(readBaseLaunch({ context, address, blockNumber: 20n })).rejects.toThrow('decimals');
});
