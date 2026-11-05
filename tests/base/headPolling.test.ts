import { afterEach, expect, it, vi } from 'vitest';
import { setTimeout as delay } from 'node:timers/promises';

import getBaseContext from '../../src/services/base/getBaseContext';
import getBaseRuntime from '../../src/services/base/getBaseRuntime';
import runBaseScanLoop from '../../src/services/base/runBaseScanLoop';
import type { BaseContext } from '../../src/types/base/configuration';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn() }));

vi.mock('../../src/logger', () => ({ default: { error: vi.fn() } }));

vi.mock('../../src/services/base/getBaseContext', () => ({ default: vi.fn() }));

afterEach((): void => {
  vi.restoreAllMocks();
});

it('polls the shared head every five seconds without giving each consumer another head request', async (): Promise<void> => {
  const controller = new AbortController();
  const getBlockNumber = vi.fn(async (): Promise<bigint> => 100n);
  let now = 100_000;

  vi.spyOn(Date, 'now').mockImplementation((): number => now);

  Object.assign(getBaseRuntime('testnet'), {
    initialized: true,
    holdingsInitialized: true,
    checkAt: Infinity,
    cleanupAt: Infinity,
  });

  vi.mocked(getBaseContext).mockResolvedValue({
    client: { getBlockNumber },
  } as unknown as BaseContext);

  vi.mocked(delay).mockImplementation(async (milliseconds): Promise<void> => {
    now += milliseconds ?? 0;

    if (getBlockNumber.mock.calls.length === 3) {
      controller.abort();
    }
  });

  await runBaseScanLoop(controller.signal, 'testnet', 'head');

  expect(getBlockNumber).toHaveBeenCalledTimes(3);

  expect(getBlockNumber).toHaveBeenCalledWith({ cacheTime: 0 });

  expect(vi.mocked(delay).mock.calls.map((call): number | undefined => call[0])).toEqual([
    5000, 5000, 5000,
  ]);
});
