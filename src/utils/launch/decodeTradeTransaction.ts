import type { rpc } from '@stellar/stellar-sdk';
import { Address, scValToNative } from '@stellar/stellar-sdk';

import parseTradeInteger from './parseTradeInteger';
import type { TradeRecord } from '../../types/launch/market';
import type { MarketIdentity } from '../../types/launch/market';

const decodeTradeTransaction = (
  transaction: rpc.Api.GetTransactionResponse,
  launch: MarketIdentity,
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
    Address.fromScAddress(call.contractAddress).toString() !== launch.contractId ||
    (side !== 'buy' && side !== 'sell') ||
    call.args.length !== 3 ||
    !transaction.returnValue
  ) {
    return null;
  }

  const [trader, rawAmount, rawLimit] = call.args.map(scValToNative) as unknown[];
  const quote = scValToNative(transaction.returnValue) as Record<string, unknown>;
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
    chain: 'stellar',
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
    executionPrice: price.toString(),
  };
};

export default decodeTradeTransaction;
