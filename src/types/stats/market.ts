import type { Chain } from '../network/chain';
import type { ProjectVolumeBucket } from './volume';

type MarketNetwork = 'testnet' | 'public';

interface MarketAccumulator {
  amount: bigint;
  tradeCount: number;
  buyCount: number;
  participants: Set<string>;
}

interface MarketLaunchStats {
  chain: Chain;
  network: MarketNetwork;
  contractId: string;
  slug: string;
  volumeTotal: ProjectVolumeBucket;
  participantCount: number;
}

interface MarketStatsGroup {
  chain: Chain | 'all';
  network: MarketNetwork;
  volumeTotal: ProjectVolumeBucket;
  launchCount: number;
  participantCount: number;
  userCount: number;
  launches: MarketLaunchStats[];
}

interface MarketStats {
  currency: 'USDC';
  multiplier: 2;
  asOf: string;
  userCountScope: 'global_active_identities';
  chains: MarketStatsGroup[];
  combined: MarketStatsGroup[];
}

export type { MarketStats, MarketNetwork, MarketStatsGroup, MarketAccumulator, MarketLaunchStats };
