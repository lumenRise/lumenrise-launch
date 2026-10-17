import type { StateTarget } from '../../types/launch/store';

const nextStatePollAt = (
  target: StateTarget,
  graduated: boolean,
  now: Date,
  sold = target.sold,
): Date | null => {
  const seconds = BigInt(Math.floor(now.getTime() / 1000));

  if (graduated || (seconds >= BigInt(target.endsAt) && sold === '0')) {
    return null;
  }

  const interval = 15 * 60_000;
  const untilStart = BigInt(target.startsAt) - seconds;

  return new Date(
    now.getTime() + (untilStart > 0n ? Math.min(Number(untilStart * 1000n), interval) : interval),
  );
};

export default nextStatePollAt;
