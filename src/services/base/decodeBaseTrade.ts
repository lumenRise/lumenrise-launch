import { decodeEventLog } from 'viem';

import launchAbi from '../../constants/base/launchAbi';
import type { TradeRecord } from '../../types/launch/market';
import type { BaseTradeInput } from '../../types/base/events';

const decodeBaseTrade = (input: BaseTradeInput): TradeRecord => {
  const { log, network, timestamp, assetDecimals } = input;

  if (
    log.removed ||
    log.blockNumber === null ||
    log.blockHash === null ||
    log.transactionHash === null ||
    log.transactionIndex === null ||
    log.logIndex === null ||
    log.blockNumber > BigInt(Number.MAX_SAFE_INTEGER) ||
    timestamp > 8_640_000_000_000n ||
    !Number.isInteger(assetDecimals) ||
    assetDecimals < 0 ||
    assetDecimals > 18
  ) {
    throw new Error('Invalid Base trade log position or token decimals');
  }

  const decoded = decodeEventLog({
    abi: launchAbi,
    data: log.data,
    topics: log.topics,
    strict: true,
  });

  if (decoded.eventName !== 'Bought' && decoded.eventName !== 'Sold') {
    throw new Error('Unsupported Base trade event');
  }

  const isBuy = decoded.eventName === 'Bought';
  const trader = decoded.eventName === 'Bought' ? decoded.args.buyer : decoded.args.seller;
  const assetAmount = decoded.eventName === 'Bought' ? decoded.args.received : decoded.args.amount;

  const grossAmount =
    decoded.eventName === 'Bought'
      ? decoded.args.payment - decoded.args.creator_fee
      : decoded.args.received + decoded.args.creator_fee;

  if (
    assetAmount <= 0n ||
    grossAmount <= 0n ||
    assetAmount >= 2n ** 128n ||
    grossAmount >= 2n ** 128n ||
    /^0x0{40}$/i.test(trader)
  ) {
    throw new Error('Invalid Base trade amounts');
  }

  const price = (grossAmount * 10n ** BigInt(assetDecimals) + assetAmount - 1n) / assetAmount;

  return {
    chain: 'base',
    network,
    contractId: log.address.toLowerCase(),
    transactionHash: log.transactionHash.toLowerCase(),
    operationIndex: log.logIndex,
    transactionIndex: log.transactionIndex,
    ledger: Number(log.blockNumber),
    tradedAt: new Date(Number(timestamp) * 1000),
    trader: trader.toLowerCase(),
    side: isBuy ? 'buy' : 'sell',
    assetAmount: assetAmount.toString(),
    grossAmount: grossAmount.toString(),
    executionPrice: price.toString(),
  };
};

export default decodeBaseTrade;
