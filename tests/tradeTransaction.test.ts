import { describe, expect, it } from 'vitest';
import type { rpc } from '@stellar/stellar-sdk';
import {
  Account,
  Address,
  Contract,
  Keypair,
  Networks,
  StrKey,
  TransactionBuilder,
  nativeToScVal,
} from '@stellar/stellar-sdk';

import type { LaunchData } from '../src/types/launch';
import decodeTradeTransaction from '../src/chain/decodeTradeTransaction';

const trader = Keypair.random().publicKey();
const curve = StrKey.encodeContract(Buffer.alloc(32, 1));
const launch = { network: 'testnet', contractId: curve } as LaunchData;
const transaction = (
  side: string,
  amount: bigint,
  limit: bigint,
  quote: unknown,
  feeBump = false,
) => {
  const inner = new TransactionBuilder(new Account(trader, '1'), {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      new Contract(curve).call(
        side,
        new Address(trader).toScVal(),
        nativeToScVal(amount),
        nativeToScVal(limit),
      ),
    )
    .setTimeout(30)
    .build();
  const tx = feeBump
    ? TransactionBuilder.buildFeeBumpTransaction(trader, '100', inner, Networks.TESTNET)
    : inner;
  return {
    status: 'SUCCESS',
    txHash: 'a'.repeat(64),
    ledger: 100,
    createdAt: 1_800_000_000,
    applicationOrder: 2,
    envelopeXdr: tx.toEnvelope(),
    returnValue: nativeToScVal(quote),
  } as rpc.Api.GetSuccessfulTransactionResponse;
};

describe('verified direct curve trade decoding', () => {
  it('keeps large exact amounts and derives pre-fee execution price', () => {
    const amount = 9_007_199_254_740_993n;
    const trade = decodeTradeTransaction(
      transaction('buy', amount, amount * 2n, {
        gross: amount,
        creator_fee: 1n,
        user_amount: amount + 1n,
      }),
      launch,
    );
    expect(trade).toMatchObject({
      side: 'buy',
      assetAmount: amount.toString(),
      grossAmount: amount.toString(),
      creatorFee: '1',
      userAmount: (amount + 1n).toString(),
      executionPrice: '10000000',
      trader,
      ledger: 100,
      operationIndex: 0,
      transactionIndex: 2,
    });
  });
  it('decodes fee-bump sells and distinguishes gross from receipt', () => {
    const trade = decodeTradeTransaction(
      transaction(
        'sell',
        10_000_000n,
        19_000_000n,
        { gross: 20_000_000n, creator_fee: 100_000n, user_amount: 19_900_000n },
        true,
      ),
      launch,
    );
    expect(trade).toMatchObject({
      side: 'sell',
      executionPrice: '20000000',
      userAmount: '19900000',
    });
  });
  it('does not classify transfers or another curve as trades', () => {
    const tx = transaction('transfer', 1n, 1n, 1n);
    expect(decodeTradeTransaction(tx, launch)).toBeNull();
    expect(
      decodeTradeTransaction(
        transaction('buy', 1n, 2n, {
          gross: 1n,
          creator_fee: 0n,
          user_amount: 1n,
        }),
        { ...launch, contractId: trader },
      ),
    ).toBeNull();
    expect(
      decodeTradeTransaction({ status: 'FAILED' } as rpc.Api.GetTransactionResponse, launch),
    ).toBeNull();
  });
  it('rejects inconsistent quote or slippage evidence', () => {
    expect(() =>
      decodeTradeTransaction(
        transaction('buy', 1n, 2n, {
          gross: 1n,
          creator_fee: 1n,
          user_amount: 1n,
        }),
        launch,
      ),
    ).toThrow('does not match');
    expect(() =>
      decodeTradeTransaction(
        transaction('sell', 1n, 2n, {
          gross: 1n,
          creator_fee: 0n,
          user_amount: 1n,
        }),
        launch,
      ),
    ).toThrow('does not match');
  });
});
