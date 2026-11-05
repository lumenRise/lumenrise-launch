import type { MarketAccumulator } from '../../types/stats/market';

const createMarketAccumulator = (): MarketAccumulator => ({
  amount: 0n,
  tradeCount: 0,
  buyCount: 0,
  participants: new Set<string>(),
});

export default createMarketAccumulator;
