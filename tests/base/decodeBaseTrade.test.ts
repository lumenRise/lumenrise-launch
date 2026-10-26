import { expect, it } from 'vitest';

import createBaseLog from '../helpers/createBaseLog';
import decodeBaseTrade from '../../src/services/base/decodeBaseTrade';

it('decodes exact amounts and preserves distinct events in one transaction', (): void => {
  const first = decodeBaseTrade({
    network: 'testnet',
    log: createBaseLog(2),
    timestamp: 1_700_000_000n,
  });

  const second = decodeBaseTrade({
    network: 'testnet',
    log: createBaseLog(4),
    timestamp: 1_700_000_000n,
  });

  expect(first).toMatchObject({
    chain: 'base',
    network: 'testnet',
    side: 'buy',
    assetAmount: '10000000',
    grossAmount: '20000000',
    executionPrice: '20000000',
    operationIndex: 2,
    ledger: 20,
  });

  expect(second.transactionHash).toBe(first.transactionHash);

  expect(second.operationIndex).not.toBe(first.operationIndex);
});

it('does not confuse Base public and testnet trades', (): void => {
  const log = createBaseLog();

  expect(decodeBaseTrade({ network: 'public', log, timestamp: 1n }).network).toBe('public');

  expect(decodeBaseTrade({ network: 'testnet', log, timestamp: 1n }).network).toBe('testnet');
});

it('rejects removed, pending and malformed event logs', (): void => {
  const log = createBaseLog();

  expect(() =>
    decodeBaseTrade({ network: 'testnet', log: { ...log, removed: true }, timestamp: 1n }),
  ).toThrow();

  expect(() =>
    decodeBaseTrade({ network: 'testnet', log: { ...log, logIndex: null }, timestamp: 1n }),
  ).toThrow();

  expect(() =>
    decodeBaseTrade({ network: 'testnet', log: { ...log, data: '0x' }, timestamp: 1n }),
  ).toThrow();
});
