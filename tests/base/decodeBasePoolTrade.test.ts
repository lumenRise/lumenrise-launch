import { expect, it } from 'vitest';

import createBaseSwapLog from '../helpers/createBaseSwapLog';
import { asset, pair, curve, pool, trader } from '../helpers/basePoolFixture';
import decodeBasePoolTrade from '../../src/services/base/decodeBasePoolTrade';

it('decodes buys and sells in either currency order using signed caller deltas', (): void => {
  const base = {
    network: 'testnet' as const,
    contractId: curve,
    asset,
    assetDecimals: 18,
    pool,
    timestamp: 100n,
    trader,
  };

  expect(decodeBasePoolTrade({ ...base, log: createBaseSwapLog() })).toMatchObject({
    side: 'buy',
    trader,
    contractId: curve,
    assetAmount: '1000000000000000000',
    grossAmount: '2000000',
    executionPrice: '2000000',
    operationIndex: 4,
  });

  expect(
    decodeBasePoolTrade({ ...base, log: createBaseSwapLog(-(10n ** 18n), 1900000n) }),
  ).toMatchObject({
    side: 'sell',
    grossAmount: '1900000',
    executionPrice: '1900000',
  });

  expect(
    decodeBasePoolTrade({
      ...base,
      asset: pair,
      assetDecimals: 6,
      log: createBaseSwapLog(-2000000n, 10n ** 18n),
    }),
  ).toMatchObject({
    side: 'buy',
    assetAmount: '1000000000000000000',
    grossAmount: '2000000',
    executionPrice: '1',
  });

  expect(
    decodeBasePoolTrade({ ...base, asset: pair, log: createBaseSwapLog(2000000n, -(10n ** 18n)) })
      .side,
  ).toBe('sell');
});

it('rejects wrong managers, unrelated pools, invalid positions and non-swap deltas', (): void => {
  const input = {
    network: 'testnet' as const,
    contractId: curve,
    asset,
    assetDecimals: 18,
    pool,
    timestamp: 100n,
    trader,
    log: createBaseSwapLog(),
  };

  expect(() =>
    decodeBasePoolTrade({ ...input, pool: { ...pool, poolId: `0x${'c'.repeat(64)}` } }),
  ).toThrow('another pool');
  expect(() => decodeBasePoolTrade({ ...input, log: { ...input.log, address: curve } })).toThrow(
    'position',
  );
  expect(() => decodeBasePoolTrade({ ...input, log: { ...input.log, removed: true } })).toThrow(
    'position',
  );
  expect(() => decodeBasePoolTrade({ ...input, log: createBaseSwapLog(10n, 10n) })).toThrow(
    'amounts',
  );
  expect(() => decodeBasePoolTrade({ ...input, log: createBaseSwapLog(0n, -10n) })).toThrow(
    'amounts',
  );
});
