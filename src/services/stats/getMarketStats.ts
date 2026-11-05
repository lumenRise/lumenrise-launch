import Launch from '../../models/Launch';
import LaunchTrade from '../../models/LaunchTrade';
import toMarketVolume from '../../utils/stats/toMarketVolume';
import getLaunchScales from '../../utils/launch/getLaunchScales';
import createMarketAccumulator from '../../utils/stats/createMarketAccumulator';
import type {
  MarketStats,
  MarketNetwork,
  MarketStatsGroup,
  MarketAccumulator,
  MarketLaunchStats,
} from '../../types/stats/market';

const getMarketStats = async (now: Date, userCount: number): Promise<MarketStats> => {
  const launches = await Launch.find({})
    .select('chain network contractId slug assetDecimals pairDecimals')
    .lean();

  const markets = new Map<string, MarketAccumulator>();
  const totals = new Map<string, MarketAccumulator>();
  const scales = new Map<string, number>();
  const chains = ['stellar', 'base'] as const;
  const networks: MarketNetwork[] = ['testnet', 'public'];

  for (const network of networks) {
    for (const chain of [...chains, 'all'] as const) {
      totals.set(`${chain}:${network}`, createMarketAccumulator());
    }
  }

  for (const launch of launches) {
    const key = `${launch.chain ?? 'stellar'}:${launch.network}:${launch.contractId}`;

    markets.set(key, createMarketAccumulator());

    scales.set(key, getLaunchScales(launch).priceScale);
  }

  const trades = LaunchTrade.find({ tradedAt: { $lte: now } })
    .select('chain network contractId grossAmount trader side')
    .lean()
    .cursor();

  try {
    for await (const trade of trades) {
      const chain = trade.chain ?? 'stellar';
      const key = `${chain}:${trade.network}:${trade.contractId}`;
      const scale = scales.get(key);
      const market = markets.get(key);
      const total = totals.get(`${chain}:${trade.network}`);
      const combined = totals.get(`all:${trade.network}`);

      if (
        scale === undefined ||
        !market ||
        !total ||
        !combined ||
        !/^\d+$/.test(trade.grossAmount) ||
        !trade.trader ||
        (trade.side !== 'buy' && trade.side !== 'sell')
      ) {
        throw new Error('Trade has invalid market statistics data');
      }

      const amount = BigInt(trade.grossAmount) * 10n ** BigInt(18 - scale);
      const trader = chain === 'base' ? trade.trader.toLowerCase() : trade.trader;

      for (const bucket of [market, total, combined]) {
        bucket.amount += amount;

        bucket.tradeCount += 1;

        bucket.buyCount += trade.side === 'buy' ? 1 : 0;

        bucket.participants.add(`${chain}:${trader}`);
      }
    }
  } finally {
    await trades.close();
  }

  const launchStats: MarketLaunchStats[] = [];

  for (const launch of launches) {
    const chain = launch.chain ?? 'stellar';
    const market = markets.get(`${chain}:${launch.network}:${launch.contractId}`)!;

    launchStats.push({
      chain,
      network: launch.network,
      contractId: launch.contractId,
      slug: launch.slug,
      volumeTotal: toMarketVolume(market),
      participantCount: market.participants.size,
    });
  }

  const result: MarketStats = {
    currency: 'USDC',
    multiplier: 2,
    asOf: now.toISOString(),
    userCountScope: 'global_active_identities',
    chains: [],
    combined: [],
  };

  for (const network of networks) {
    for (const chain of [...chains, 'all'] as const) {
      const total = totals.get(`${chain}:${network}`)!;
      const groupLaunches: MarketLaunchStats[] = [];

      for (const launch of launchStats) {
        if (launch.network === network && (chain === 'all' || launch.chain === chain)) {
          groupLaunches.push(launch);
        }
      }

      const group: MarketStatsGroup = {
        chain,
        network,
        volumeTotal: toMarketVolume(total),
        launchCount: groupLaunches.length,
        participantCount: total.participants.size,
        userCount,
        launches: groupLaunches,
      };

      if (chain === 'all') {
        result.combined.push(group);

        continue;
      }

      result.chains.push(group);
    }
  }

  return result;
};

export default getMarketStats;
