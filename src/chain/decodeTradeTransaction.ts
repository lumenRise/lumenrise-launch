import type { rpc } from '@stellar/stellar-sdk';
import { Address, scValToNative } from '@stellar/stellar-sdk';

import type { LaunchData } from '../types/launch';
import type { TradeRecord } from '../types/market';
import parseTradeInteger from './parseTradeInteger';

const decodeTradeTransaction = (
  transaction: rpc.Api.GetTransactionResponse,
  launch: LaunchData,
): TradeRecord | null => {
  if (transaction.status !== 'SUCCESS') {
    return null;
  }

  const envelope = transaction.envelopeXdr;

  const operations =
    envelope.type === 'envelopeTypeTx'
      ? envelope.v1.tx.operations
      : envelope.type === 'envelopeTypeTxFeeBump'
        ? envelope.feeBump.tx.innerTx.v1.tx.operations
        : envelope.v0.tx.operations;

  // The client's trade flow uses one direct invocation. Nested router calls are
  // deliberately not inferred from token transfers alone.
  if (operations.length !== 1) {
    return null;
  }

  const operation = operations[0]!;

  if (operation.body.type !== 'invokeHostFunction') {
    return null;
  }

  const host = operation.body.invokeHostFunctionOp.hostFunction;

  if (host.type !== 'hostFunctionTypeInvokeContract') {
    return null;
  }

  const call = host.invokeContract;
  const side = call.functionName.toStringStrict();

  if (
    Address.fromScAddress(call.contractAddress).toString() !==
      launch.contractId ||
    (side !== 'buy' && side !== 'sell') ||
    call.args.length !== 3 ||
    !transaction.returnValue
  ) {
    return null;
  }

  const [trader, rawAmount, rawLimit] = call.args.map(
    scValToNative,
  ) as unknown[];

  const quote = scValToNative(transaction.returnValue) as Record<
    string,
    unknown
  >;

  const amount = parseTradeInteger(rawAmount);
  const limit = parseTradeInteger(rawLimit);
  const gross = parseTradeInteger(quote.gross);
  const fee = parseTradeInteger(quote.creator_fee);
  const userAmount = parseTradeInteger(quote.user_amount);

  if (
    typeof trader !== 'string' ||
    amount <= 0n ||
    gross <= 0n ||
    fee < 0n ||
    userAmount < 0n ||
    userAmount !== (side === 'buy' ? gross + fee : gross - fee) ||
    (side === 'buy' ? userAmount > limit : userAmount < limit)
  ) {
    throw new Error('Trade return value does not match invocation');
  }

  const price = (gross * 10_000_000n + amount - 1n) / amount;

  return {
    network: launch.network,
    contractId: launch.contractId,
    transactionHash: transaction.txHash,
    operationIndex: 0,
    transactionIndex: transaction.applicationOrder,
    ledger: transaction.ledger,
    tradedAt: new Date(transaction.createdAt * 1000),
    trader,
    side,
    assetAmount: amount.toString(),
    grossAmount: gross.toString(),
    creatorFee: fee.toString(),
    userAmount: userAmount.toString(),
    executionPrice: price.toString(),
    priceSort: price.toString().padStart(39, '0'),
  };
};

export default decodeTradeTransaction;
