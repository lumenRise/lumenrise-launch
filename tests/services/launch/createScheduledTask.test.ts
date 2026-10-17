import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import createScheduledTask from '../../../src/services/launch/createScheduledTask';

vi.mock('../../../src/logger', () => ({ default: { warn: vi.fn() } }));

describe('launch scheduled tasks', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-17T00:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('runs a slow task once and starts its interval after completion', async () => {
    let finish: () => void = (): void => {};

    const run = vi.fn(
      (): Promise<void> =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    const task = createScheduledTask({ name: 'slow', intervalMs: 60_000, retryMs: 30_000, run });

    task.tick();

    await vi.advanceTimersByTimeAsync(120_000);

    task.tick();

    expect(run).toHaveBeenCalledTimes(1);

    finish();

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(59_999);

    task.tick();

    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    task.tick();

    await vi.advanceTimersByTimeAsync(0);

    expect(run).toHaveBeenCalledTimes(2);

    finish();

    await task.stop();
  });

  it('backs off failed jobs even when another launch requests a run', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('RPC down')).mockResolvedValue(undefined);
    const task = createScheduledTask({ name: 'retry', intervalMs: 60_000, retryMs: 30_000, run });

    task.tick();

    await vi.advanceTimersByTimeAsync(0);

    task.request();
    task.tick();

    await vi.advanceTimersByTimeAsync(29_999);

    task.tick();

    expect(run).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);

    task.tick();

    await vi.advanceTimersByTimeAsync(0);

    expect(run).toHaveBeenCalledTimes(2);

    await task.stop();

    task.request();

    await vi.advanceTimersByTimeAsync(120_000);

    task.tick();

    expect(run).toHaveBeenCalledTimes(2);
  });

  it('lets an independent task run while another is waiting', async () => {
    let finish: () => void = (): void => {};

    const blocked = createScheduledTask({
      name: 'blocked',
      intervalMs: 60_000,
      retryMs: 30_000,
      run: (): Promise<void> =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    });

    const run = vi.fn().mockResolvedValue(undefined);
    const other = createScheduledTask({ name: 'other', intervalMs: 1000, retryMs: 1000, run });

    blocked.tick();
    other.tick();

    await vi.advanceTimersByTimeAsync(1000);

    other.tick();

    await vi.advanceTimersByTimeAsync(0);

    expect(run).toHaveBeenCalledTimes(2);

    const stopped = blocked.stop();

    finish();

    await Promise.all([stopped, other.stop()]);
  });
});
