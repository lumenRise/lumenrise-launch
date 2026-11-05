interface TradeResult {
  trader: string;
  tradedAt: string;
  asset: string;
  side: 'buy' | 'sell';
  assetAmount: string;
  grossAmount: string;
  executionPrice: string;
}

export type { TradeResult };
