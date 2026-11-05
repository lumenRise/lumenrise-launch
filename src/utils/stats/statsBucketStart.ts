import type { StatsInterval } from '../../types/stats/activity';

const statsBucketStart = (time: number, interval: StatsInterval): number => {
  const duration = interval === 'hour' ? 3_600_000 : interval === 'day' ? 86_400_000 : 604_800_000;
  const offset = interval === 'week' ? 3 * 86_400_000 : 0;

  return Math.floor((time + offset) / duration) * duration - offset;
};

export default statsBucketStart;
