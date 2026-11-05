import Launch from '../../models/Launch';
import LaunchTrade from '../../models/LaunchTrade';
import statsScopes from '../../constants/stats/scopes';
import toMarketVolume from '../../utils/stats/toMarketVolume';
import getLaunchScales from '../../utils/launch/getLaunchScales';
import statsBucketStart from '../../utils/stats/statsBucketStart';
import createMarketAccumulator from '../../utils/stats/createMarketAccumulator';
import type {
  StatsChart,
  StatsChartQuery,
  StatsChartGroup,
  StatsChartBucket,
} from '../../types/stats/activity';

const getStatsChart = async (query: StatsChartQuery, now: Date): Promise<StatsChart> => {
  const duration =
    query.interval === 'hour' ? 3_600_000 : query.interval === 'day' ? 86_400_000 : 604_800_000;

  const start = statsBucketStart(query.from.getTime(), query.interval);
  const groups = new Map<string, Map<number, StatsChartBucket>>();

  for (const scope of statsScopes) {
    const buckets = new Map<number, StatsChartBucket>();

    for (let time = start; time < query.to.getTime(); time += duration) {
      buckets.set(time, { ...createMarketAccumulator(), launchCount: 0 });
    }

    groups.set(`${scope.chain}:${scope.network}`, buckets);
  }

  const launches = await Launch.find({})
    .select('chain network contractId assetDecimals pairDecimals createdAt')
    .lean();

  const scales = new Map<string, number>();

  for (const launch of launches) {
    const chain = launch.chain ?? 'stellar';

    scales.set(
      `${chain}:${launch.network}:${launch.contractId}`,
      getLaunchScales(launch).priceScale,
    );

    if (!launch.createdAt || launch.createdAt < query.from || launch.createdAt >= query.to) {
      continue;
    }

    const time = statsBucketStart(launch.createdAt.getTime(), query.interval);

    for (const key of [`${chain}:${launch.network}`, `all:${launch.network}`]) {
      const bucket = groups.get(key)?.get(time);

      if (bucket) {
        bucket.launchCount += 1;
      }
    }
  }

  const trades = LaunchTrade.find({
    network: { $in: ['testnet', 'public'] },
    tradedAt: { $gte: query.from, $lt: query.to },
  })
    .select('chain network contractId grossAmount tradedAt trader side')
    .lean()
    .cursor();

  try {
    for await (const trade of trades) {
      const chain = trade.chain ?? 'stellar';
      const scale = scales.get(`${chain}:${trade.network}:${trade.contractId}`);
      const time = statsBucketStart(trade.tradedAt.getTime(), query.interval);
      const bucket = groups.get(`${chain}:${trade.network}`)?.get(time);
      const combined = groups.get(`all:${trade.network}`)?.get(time);

      if (
        scale === undefined ||
        !bucket ||
        !combined ||
        !/^\d+$/.test(trade.grossAmount) ||
        !trade.trader ||
        (trade.side !== 'buy' && trade.side !== 'sell')
      ) {
        throw new Error('Trade chart data is invalid');
      }

      const amount = BigInt(trade.grossAmount) * 10n ** BigInt(18 - scale);
      const trader = chain === 'base' ? trade.trader.toLowerCase() : trade.trader;

      for (const value of [bucket, combined]) {
        value.amount += amount;

        value.tradeCount += 1;

        value.buyCount += trade.side === 'buy' ? 1 : 0;

        value.participants.add(`${chain}:${trader}`);
      }
    }
  } finally {
    await trades.close();
  }

  const result: StatsChart = {
    currency: 'USDC',
    multiplier: 2,
    asOf: now.toISOString(),
    from: query.from.toISOString(),
    to: query.to.toISOString(),
    interval: query.interval,
    timezone: 'UTC',
    chains: [],
    combined: [],
  };

  for (const scope of statsScopes) {
    const group: StatsChartGroup = { chain: scope.chain, network: scope.network, items: [] };
    const buckets = groups.get(`${scope.chain}:${scope.network}`)!;

    for (const [time, bucket] of buckets) {
      const volume = toMarketVolume(bucket);

      group.items.push({
        timestamp: new Date(Math.max(time, query.from.getTime())).toISOString(),
        endsAt: new Date(Math.min(time + duration, query.to.getTime())).toISOString(),
        launchCount: bucket.launchCount,
        tradeCount: volume.tradeCount,
        buyCount: volume.buyCount,
        sellCount: volume.sellCount,
        volume: volume.amount,
        participantCount: bucket.participants.size,
      });
    }

    if (scope.chain === 'all') {
      result.combined.push(group);

      continue;
    }

    result.chains.push(group);
  }

  return result;
};

export default getStatsChart;
