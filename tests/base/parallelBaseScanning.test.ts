import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import getBaseRuntime from '../../src/services/base/getBaseRuntime';
import getBaseContext from '../../src/services/base/getBaseContext';
import scanBaseNetwork from '../../src/services/base/scanBaseNetwork';
import runBaseScanLoop from '../../src/services/base/runBaseScanLoop';

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

  expect(getBaseRuntime('testnet').poolAt).toBeGreaterThan(Date.now() + 10_000);
});
