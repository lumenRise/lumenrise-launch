import { decodeEventLog, zeroAddress } from 'viem';

import poolAbi from '../../constants/base/poolAbi';
import type { TradeRecord } from '../../types/launch/market';
import type { BasePoolTradeInput } from '../../types/base/pool';

const decodeBasePoolTrade = (input: BasePoolTradeInput): TradeRecord => {
  const { log, pool, asset, assetDecimals, trader, timestamp } = input;

  if (
    log.removed ||
    log.blockNumber === null ||
    log.blockHash === null ||
    log.transactionHash === null ||
    log.transactionIndex === null ||
    log.logIndex === null ||
    log.blockNumber > BigInt(Number.MAX_SAFE_INTEGER) ||
    timestamp < 0n ||
    timestamp > 8_640_000_000_000n ||
    !Number.isInteger(assetDecimals) ||
    assetDecimals < 0 ||
    assetDecimals > 18 ||
    log.address.toLowerCase() !== pool.poolManager ||
    trader === zeroAddress
  ) {
    throw new Error('Invalid Base pool trade position or sender');
  }

  const { args } = decodeEventLog({ abi: poolAbi, eventName: 'Swap', ...log, strict: true });

  if (args.id !== pool.poolId) {
    throw new Error('Base swap belongs to another pool');
  }

  const assetIsCurrency0 = asset.toLowerCase() === pool.currency0;
  const assetDelta = assetIsCurrency0 ? args.amount0 : args.amount1;
  const pairDelta = assetIsCurrency0 ? args.amount1 : args.amount0;

  if (
    (asset.toLowerCase() !== pool.currency0 && asset.toLowerCase() !== pool.currency1) ||
    assetDelta === 0n ||
    pairDelta === 0n ||
    assetDelta > 0n === pairDelta > 0n
  ) {
    throw new Error('Invalid Base swap amounts');
  }

  // V4 deltas describe the caller: positive is received, negative is paid.
  const assetAmount = assetDelta > 0n ? assetDelta : -assetDelta;
  const grossAmount = pairDelta > 0n ? pairDelta : -pairDelta;
  const price = (grossAmount * 10n ** BigInt(assetDecimals) + assetAmount - 1n) / assetAmount;

  return {
    chain: 'base',
    network: input.network,
    contractId: input.contractId,
    transactionHash: log.transactionHash.toLowerCase(),
    operationIndex: log.logIndex,
    transactionIndex: log.transactionIndex,
    ledger: Number(log.blockNumber),
    tradedAt: new Date(Number(timestamp) * 1000),
    trader: trader.toLowerCase(),
    side: assetDelta > 0n ? 'buy' : 'sell',
    assetAmount: assetAmount.toString(),
    grossAmount: grossAmount.toString(),
    executionPrice: price.toString(),
  };
};

export default decodeBasePoolTrade;
