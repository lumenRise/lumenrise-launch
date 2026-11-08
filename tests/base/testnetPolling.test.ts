import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import TestnetActivity from '../../src/models/TestnetActivity';
import getBaseContext from '../../src/services/base/getBaseContext';
import getBaseRuntime from '../../src/services/base/getBaseRuntime';
import runBaseScanLoop from '../../src/services/base/runBaseScanLoop';
import networkActivityEvents from '../../src/services/launch/networkActivityEvents';

vi.mock('node:timers/promises', (): object => ({
  setTimeout: (milliseconds: number): Promise<void> =>
    new Promise((resolve: () => void): void => {
      setTimeout(resolve, milliseconds);
    }),
}));

vi.mock('../../src/logger', (): object => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../src/services/base/getBaseContext', (): object => ({ default: vi.fn() }));

vi.mock('../../src/models/TestnetActivity', (): object => ({ default: { findById: vi.fn() } }));

beforeEach((): void => {
  vi.clearAllMocks();

  vi.useFakeTimers();

  vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));

  vi.mocked(TestnetActivity.findById).mockReturnValue({
    lean: vi.fn().mockResolvedValue(null),
  } as never);

  Object.assign(getBaseRuntime('testnet'), {
    initialized: true,
    holdingsInitialized: true,
    checkAt: Infinity,
    cleanupAt: Infinity,
  });
});

afterEach((): void => {
  networkActivityEvents.removeAllListeners();

  vi.useRealTimers();
});

it('stops head RPC after 30 idle minutes and resumes on later activity', async (): Promise<void> => {
  const controller = new AbortController();
  const getBlockNumber = vi.fn().mockResolvedValue(100n);

  vi.mocked(getBaseContext).mockResolvedValue({ client: { getBlockNumber } } as never);

  const running = runBaseScanLoop(controller.signal, 'testnet', 'head');

  await vi.advanceTimersByTimeAsync(0);

  expect(getBaseContext).not.toHaveBeenCalled();

  vi.mocked(TestnetActivity.findById).mockReturnValue({
    lean: vi
      .fn()
      .mockResolvedValue({ network: 'testnet', activeUntil: new Date(Date.now() + 30 * 60_000) }),
  } as never);

  networkActivityEvents.emit('base');

  await vi.advanceTimersByTimeAsync(30 * 60_000);

  expect(getBlockNumber).toHaveBeenCalledTimes(30);

  await vi.advanceTimersByTimeAsync(60_000);

  expect(getBlockNumber).toHaveBeenCalledTimes(30);

  vi.setSystemTime(Date.now() + 30 * 60 * 60_000);

  vi.mocked(TestnetActivity.findById).mockReturnValue({
    lean: vi
      .fn()
      .mockResolvedValue({ network: 'testnet', activeUntil: new Date(Date.now() + 30 * 60_000) }),
  } as never);

  networkActivityEvents.emit('base');

  await vi.advanceTimersByTimeAsync(0);

  expect(getBlockNumber).toHaveBeenCalledTimes(31);

  expect(getBaseRuntime('testnet').initialized).toBe(true);

  controller.abort();

  await vi.advanceTimersByTimeAsync(60_000);

  await running;
});
