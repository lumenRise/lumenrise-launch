import type { Chain } from '../network/chain';
import type { MarketNetwork, MarketAccumulator } from './market';

interface StatsScope {
  chain: Chain | 'all';
  network: MarketNetwork;
  cursorKey: string;
}

interface StatsTradeCursor {
  id: string;
  tradedAt: Date;
  asOf: Date;
}

interface StatsTradeQuery {
  limit: number;
  cursors: Map<string, StatsTradeCursor>;
}

interface StatsTradeItem {
  id: string;
  hash: string;
  chain: Chain;
  network: MarketNetwork;
  launch: { slug: string; name: string; symbol: string; logo: string };
  trader: string;
  tradedAt: string;
  side: 'buy' | 'sell';
  assetAmount: string;
  price: string;
  amount: string;
}

interface StatsTradePage {
  chain: Chain | 'all';
  network: MarketNetwork;
  asOf: string;
  items: StatsTradeItem[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface StatsTrades {
  currency: 'USDC';
  limit: number;
  chains: StatsTradePage[];
  combined: StatsTradePage[];
}

type StatsInterval = 'hour' | 'day' | 'week';

interface StatsChartQuery {
  from: Date;
  to: Date;
  interval: StatsInterval;
}

interface StatsChartBucket extends MarketAccumulator {
  launchCount: number;
}

interface StatsChartPoint {
  timestamp: string;
  endsAt: string;
  launchCount: number;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
  volume: string;
  participantCount: number;
}

interface StatsChartGroup {
  chain: Chain | 'all';
  network: MarketNetwork;
  items: StatsChartPoint[];
}

interface StatsChart {
  currency: 'USDC';
  multiplier: 2;
  asOf: string;
  from: string;
  to: string;
  interval: StatsInterval;
  timezone: 'UTC';
  chains: StatsChartGroup[];
  combined: StatsChartGroup[];
}

export type {
  StatsScope,
  StatsTrades,
  StatsInterval,
  StatsTradeItem,
  StatsTradePage,
  StatsTradeQuery,
  StatsTradeCursor,
  StatsChart,
  StatsChartQuery,
  StatsChartGroup,
  StatsChartPoint,
  StatsChartBucket,
};
