import { decodeEventLog } from 'viem';

import launchAbi from '../../constants/base/launchAbi';
import type { TradeRecord } from '../../types/launch/market';
import type { BaseTradeInput } from '../../types/base/events';

const decodeBaseTrade = (input: BaseTradeInput): TradeRecord => {
  const { log, network, timestamp } = input;

  if (
    log.removed ||
    log.blockNumber === null ||
    log.blockHash === null ||
    log.transactionHash === null ||
    log.transactionIndex === null ||
    log.logIndex === null ||
    log.blockNumber > BigInt(Number.MAX_SAFE_INTEGER) ||
    timestamp > 8_640_000_000_000n
  ) {
    throw new Error('Invalid Base trade log position');
  }

  const decoded = decodeEventLog({
    abi: launchAbi,
    data: log.data,
    topics: log.topics,
    eventName: 'Trade',
    strict: true,
  });

  const event = decoded.args;

  if (
    event.assetAmount <= 0n ||
    event.grossAmount <= 0n ||
    event.userAmount !==
      (event.isBuy ? event.grossAmount + event.creatorFee : event.grossAmount - event.creatorFee) ||
    event.userAmount < 0n ||
    /^0x0{40}$/i.test(event.trader)
  ) {
    throw new Error('Invalid Base trade amounts');
  }

  const price = (event.grossAmount * 10_000_000n + event.assetAmount - 1n) / event.assetAmount;

  if (price.toString().length > 39) {
    throw new Error('Base trade price exceeds the supported contract range');
  }

  return {
    chain: 'base',
    network,
    contractId: log.address.toLowerCase(),
    transactionHash: log.transactionHash.toLowerCase(),
    operationIndex: log.logIndex,
    transactionIndex: log.transactionIndex,
    ledger: Number(log.blockNumber),
    tradedAt: new Date(Number(timestamp) * 1000),
    trader: event.trader.toLowerCase(),
    side: event.isBuy ? 'buy' : 'sell',
    assetAmount: event.assetAmount.toString(),
    grossAmount: event.grossAmount.toString(),
    executionPrice: price.toString(),
  };
};

export default decodeBaseTrade;
