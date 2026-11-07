import { setTimeout as delay } from 'node:timers/promises';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import getBaseRuntime from '../../src/services/base/getBaseRuntime';
import getBaseContext from '../../src/services/base/getBaseContext';
import scanBaseNetwork from '../../src/services/base/scanBaseNetwork';
import runBaseScanLoop from '../../src/services/base/runBaseScanLoop';

vi.mock('node:timers/promises', () => ({ setTimeout: vi.fn() }));

vi.mock('../../src/logger', () => ({ default: { error: vi.fn() } }));

vi.mock('../../src/services/base/getBaseContext', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/scanBaseNetwork', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/acquireBaseLease', () => ({ default: vi.fn(async () => null) }));

vi.mock('../../src/services/base/markBaseImagesForCleanup', () => ({ default: vi.fn() }));

beforeEach((): void => {
  vi.clearAllMocks();

  const runtime = getBaseRuntime('testnet');

  Object.assign(runtime, {
    initialized: true,
    holdingsInitialized: true,
    head: 100n,
    headObservedAt: Date.now(),
    factoryAt: 0,
    poolAt: 0,
    checkAt: 0,
    cleanupAt: Infinity,
    historyActive: false,
  });
});

afterEach((): void => {
  vi.restoreAllMocks();
});

it('factory work consumes the shared head without issuing another latest-block request', async (): Promise<void> => {
  const controller = new AbortController();

  vi.mocked(scanBaseNetwork).mockImplementation(async (): Promise<boolean> => {
    controller.abort();

    return true;
  });

  await runBaseScanLoop(controller.signal, 'testnet', 'live');

  expect(getBaseContext).not.toHaveBeenCalled();

  expect(scanBaseNetwork).toHaveBeenCalledExactlyOnceWith('testnet', 'live');

  expect(getBaseRuntime('testnet').factoryAt).toBeGreaterThan(Date.now() + 55_000);
});

it('shares the observed head with pool work without creating another RPC client', async (): Promise<void> => {
  const controller = new AbortController();

  vi.mocked(scanBaseNetwork).mockImplementation(async (): Promise<boolean> => {
    controller.abort();

    return true;
  });

  await runBaseScanLoop(controller.signal, 'testnet', 'pool');

  expect(getBaseContext).not.toHaveBeenCalled();

  expect(scanBaseNetwork).toHaveBeenCalledExactlyOnceWith('testnet', 'pool');

  expect(getBaseRuntime('testnet').poolAt).toBeGreaterThan(Date.now() + 55_000);
});

it.each(['live', 'pool'] as const)(
  'waits for a fresh shared head before %s scans become due',
  async (mode): Promise<void> => {
    const controller = new AbortController();
    const runtime = getBaseRuntime('testnet');
    let ticks = 0;

    runtime.headObservedAt = Date.now() - 60000;

    vi.mocked(delay).mockImplementation(async (): Promise<void> => {
      if (ticks === 0) {
        expect(scanBaseNetwork).not.toHaveBeenCalled();
      }

      ticks += 1;

      if (ticks === 1) {
        runtime.head = 200n;
        runtime.headObservedAt = Date.now();
      }
    });

    vi.mocked(scanBaseNetwork).mockImplementation(async (): Promise<boolean> => {
      expect(runtime.head).toBe(200n);

      controller.abort();

      return true;
    });

    await runBaseScanLoop(controller.signal, 'testnet', mode);

    expect(scanBaseNetwork).toHaveBeenCalledExactlyOnceWith('testnet', mode);

    expect(getBaseContext).not.toHaveBeenCalled();
  },
);

it('scans pools once per minute while reusing fresh shared observations', async (): Promise<void> => {
  const controller = new AbortController();
  const runtime = getBaseRuntime('testnet');
  const observations: number[] = [];
  let now = 100000;

  vi.spyOn(Date, 'now').mockImplementation((): number => now);

  runtime.headObservedAt = now;

  vi.mocked(scanBaseNetwork).mockImplementation(async (): Promise<boolean> => {
    observations.push(now);

    if (observations.length === 2) {
      controller.abort();
    }

    return true;
  });

  vi.mocked(delay).mockImplementation(async (milliseconds): Promise<void> => {
    now += milliseconds ?? 0;

    if (now >= 160000) {
      runtime.headObservedAt = now;
    }
  });

  await runBaseScanLoop(controller.signal, 'testnet', 'pool');

  expect(observations).toEqual([100000, 160000]);

  expect(getBaseContext).not.toHaveBeenCalled();
});
