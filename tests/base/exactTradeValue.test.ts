import { expect, it } from 'vitest';
import { encodeAbiParameters } from 'viem';

import createBaseLog from '../helpers/createBaseLog';
import toTradeResult from '../../src/utils/launch/toTradeResult';
import decodeBaseTrade from '../../src/services/base/decodeBaseTrade';

it('returns the exact pair value when the rounded Base price overstates a purchase', (): void => {
  const assetAmount = 18_954_085_201n * 10n ** 15n;

  const trade = decodeBaseTrade({
    network: 'testnet',
    assetDecimals: 18,
    timestamp: 100n,
    log: {
      ...createBaseLog(),
      data: encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'uint256' }, { type: 'uint256' }],
        [2_000_000_000n, assetAmount, 0n],
      ),
    },
  });

  const result = toTradeResult(trade, 'token');

  expect(result.grossAmount).toBe('2000000000');

  expect(result.executionPrice).toBe('106');

  expect((BigInt(result.assetAmount) * BigInt(result.executionPrice)) / 10n ** 18n).toBe(
    2_009_133_031n,
  );
});
