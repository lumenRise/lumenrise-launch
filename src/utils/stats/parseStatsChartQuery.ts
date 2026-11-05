import statsBucketStart from './statsBucketStart';
import type { StatsChartQuery, StatsInterval } from '../../types/stats/activity';

const parseStatsChartQuery = (
  query: Record<string, unknown>,
  now: Date,
): StatsChartQuery | null => {
  const intervals: StatsInterval[] = ['hour', 'day', 'week'];
  const interval = query.interval === undefined ? 'day' : query.interval;

  if (!intervals.includes(interval as StatsInterval)) {
    return null;
  }

  for (const value of [query.from, query.to]) {
    if (
      value !== undefined &&
      (typeof value !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value.slice(0, 10)).toISOString().slice(0, 10) !== value.slice(0, 10))
    ) {
      return null;
    }
  }

  const to = query.to === undefined ? now : new Date(query.to as string);

  const from =
    query.from === undefined
      ? new Date(to.getTime() - 30 * 86_400_000)
      : new Date(query.from as string);

  const selected = interval as StatsInterval;
  const duration = selected === 'hour' ? 3_600_000 : selected === 'day' ? 86_400_000 : 604_800_000;

  const bucketCount = Math.ceil(
    (to.getTime() - statsBucketStart(from.getTime(), selected)) / duration,
  );

  if (
    from >= to ||
    to > now ||
    to.getTime() - from.getTime() > 366 * 86_400_000 ||
    bucketCount > 1000
  ) {
    return null;
  }

  return { from, to, interval: selected };
};

export default parseStatsChartQuery;
