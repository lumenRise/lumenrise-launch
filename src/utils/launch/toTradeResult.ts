import type { TradeRecord } from '../../types/launch/market';
import type { TradeResult } from '../../types/launch/tradeResult';

const toTradeResult = (trade: TradeRecord, asset: string): TradeResult => ({
  trader: trade.trader,
  tradedAt: trade.tradedAt.toISOString(),
  asset,
  side: trade.side,
  assetAmount: trade.assetAmount,
  grossAmount: trade.grossAmount,
  executionPrice: trade.executionPrice,
});

export default toTradeResult;
