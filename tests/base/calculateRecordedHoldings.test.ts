import { expect, it } from 'vitest';

import type { TradeRecord } from '../../src/types/launch/market';
import calculateRecordedHoldings from '../../src/services/base/calculateRecordedHoldings';

const buy = {
  trader: '0xABC',
  transactionHash: 'buy',
  operationIndex: 0,
  side: 'buy',
  assetAmount: '100000000000000000000000000000000000000',
  ledger: 1,
  tradedAt: new Date('2026-01-01'),
} as TradeRecord;

it('uses exact asset units, subtracts sales, and ignores duplicate event identities', (): void => {
  const sell = {
    ...buy,
    transactionHash: 'sell',
    side: 'sell' as const,
    assetAmount: '1',
    ledger: 2,
  };

  const result = calculateRecordedHoldings([buy, sell, buy]);

  expect(result).toHaveLength(1);

  expect(result[0]).toMatchObject({
    address: '0xabc',
    amount: BigInt(buy.assetAmount) - 1n,
    observedBlock: 2,
  });
});

it('preserves negative and zero totals without inventing holdings', (): void => {
  expect(calculateRecordedHoldings([{ ...buy, side: 'sell' }])[0]?.amount).toBe(
    -BigInt(buy.assetAmount),
  );

  expect(
    calculateRecordedHoldings([buy, { ...buy, transactionHash: 'sell', side: 'sell' }])[0]?.amount,
  ).toBe(0n);
});
