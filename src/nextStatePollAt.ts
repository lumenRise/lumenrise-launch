import type { StateTarget } from './types/launch';

const nextStatePollAt = (
  target: StateTarget,
  graduated: boolean,
  now: Date,
): Date => {
  const nowMs = now.getTime();
  const nowSeconds = BigInt(Math.floor(nowMs / 1000));
  const startsAt = BigInt(target.startsAt);
  const endsAt = BigInt(target.endsAt);

  if (graduated) {
    return new Date(nowMs + 5 * 60_000);
  }

  if (nowSeconds >= endsAt) {
    return new Date(nowMs + 60_000);
  }

  if (nowSeconds < startsAt) {
    const untilStartMs = Number((startsAt - nowSeconds) * 1000n);
    return new Date(nowMs + Math.min(untilStartMs, 5 * 60_000));
  }
  return new Date(nowMs + 20_000);
};

export default nextStatePollAt;
