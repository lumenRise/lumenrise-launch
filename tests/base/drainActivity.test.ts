import { beforeEach, expect, it, vi } from 'vitest';

import type { BaseScanMode } from '../../src/types/base/launch';
import drainBaseScan from '../../src/services/base/drainBaseScan';
import getBaseRuntime from '../../src/services/base/getBaseRuntime';
import scanBaseNetwork from '../../src/services/base/scanBaseNetwork';
import isNetworkActive from '../../src/services/launch/isNetworkActive';

vi.mock('../../src/services/base/scanBaseNetwork', (): object => ({ default: vi.fn() }));

vi.mock('../../src/services/launch/isNetworkActive', (): object => ({ default: vi.fn() }));

beforeEach((): void => {
  vi.resetAllMocks();
});

it.each(['live', 'history', 'pool'] as const)(
  'pauses %s catch-up between existing batches and resumes without resetting progress',
  async (mode: BaseScanMode): Promise<void> => {
    const runtime = getBaseRuntime('testnet');
    const signal = new AbortController().signal;

    vi.mocked(isNetworkActive).mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    vi.mocked(scanBaseNetwork).mockImplementationOnce(async (): Promise<boolean> => {
      runtime.progress.set(mode, true);

      return false;
    });

    expect(await drainBaseScan('testnet', mode, signal)).toBe(false);

    expect(scanBaseNetwork).toHaveBeenCalledTimes(1);

    expect(runtime.progress.get(mode)).toBe(true);

    vi.mocked(isNetworkActive).mockResolvedValue(true);

    vi.mocked(scanBaseNetwork).mockResolvedValue(true);

    expect(await drainBaseScan('testnet', mode, signal)).toBe(true);

    expect(scanBaseNetwork).toHaveBeenCalledTimes(2);
  },
);
