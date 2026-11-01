import { afterEach, expect, it, vi } from 'vitest';

import readBasePool from '../../src/services/base/readBasePool';
import type { BaseContext } from '../../src/types/base/configuration';
import { pool, key, curve, asset, pair, graduation } from '../helpers/basePoolFixture';

const readContract = vi.fn();

const context = {
  configuration: { network: 'testnet' },
  client: { readContract },
} as unknown as BaseContext;

const input = { context, address: curve, blockNumber: 20n, asset, pair, assetDecimals: 18 };

afterEach((): void => {
  vi.resetAllMocks();
});

it('validates the pool key hash and reads a block-consistent graduation and pool snapshot', async (): Promise<void> => {
  readContract
    .mockResolvedValueOnce(graduation)
    .mockResolvedValueOnce([key, 0n])
    .mockResolvedValueOnce([1n << 96n, 0, 0, 3000])
    .mockResolvedValueOnce(340490822233631430n);

  const result = await readBasePool(input);

  expect(result.pool).toEqual(pool);
  expect(result.graduationState).toMatchObject({
    settled: true,
    token_id: '33196',
    asset_dust: '1',
  });
  expect(result.price).toBe(10n ** 18n);
  expect(readContract.mock.calls.every(([call]) => call.blockNumber === 20n)).toBe(true);
});

it('fails closed for unsettled graduations and mismatched pool keys', async (): Promise<void> => {
  readContract.mockResolvedValueOnce({ ...graduation, settled: false });

  await expect(readBasePool(input)).rejects.toThrow('settled');

  readContract
    .mockResolvedValueOnce(graduation)
    .mockResolvedValueOnce([{ ...key, hooks: curve }, 0n]);

  await expect(readBasePool(input)).rejects.toThrow('match');

  readContract
    .mockResolvedValueOnce(graduation)
    .mockResolvedValueOnce([{ ...key, currency1: curve }, 0n]);

  await expect(readBasePool(input)).rejects.toThrow('match');
});
