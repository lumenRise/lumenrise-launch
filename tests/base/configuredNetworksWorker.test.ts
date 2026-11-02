import { afterEach, expect, it, vi } from 'vitest';

import runBaseWorker from '../../src/services/base/runBaseWorker';
import getBaseNetworks from '../../src/services/base/getBaseNetworks';
import runBaseScanLoop from '../../src/services/base/runBaseScanLoop';
import getBaseConfiguration from '../../src/services/base/getBaseConfiguration';

vi.mock('../../src/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));

vi.mock('../../src/services/base/getBaseConfiguration', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/runBaseScanLoop', () => ({ default: vi.fn() }));

afterEach((): void => {
  vi.resetAllMocks();
});

it.each(['both', 'public', 'testnet'] as const)(
  'starts live and history workers for configured Base networks: %s',
  async (mode: 'both' | 'public' | 'testnet'): Promise<void> => {
    const controller = new AbortController();
    const expectedNetworks = mode === 'both' ? (['testnet', 'public'] as const) : [mode];

    vi.mocked(getBaseConfiguration).mockImplementation(
      (network: 'testnet' | 'public'): ReturnType<typeof getBaseConfiguration> => {
        if (!expectedNetworks.includes(network)) {
          return null;
        }

        return { network } as never;
      },
    );

    vi.mocked(runBaseScanLoop).mockResolvedValue();

    const networks = getBaseNetworks();

    expect(networks).toEqual(expectedNetworks);

    await runBaseWorker(controller.signal, networks);

    expect(getBaseConfiguration).toHaveBeenCalledWith('testnet');
    expect(getBaseConfiguration).toHaveBeenCalledWith('public');
    expect(runBaseScanLoop).toHaveBeenCalledTimes(expectedNetworks.length * 2);

    for (const network of expectedNetworks) {
      expect(runBaseScanLoop).toHaveBeenCalledWith(controller.signal, network, 'live');
      expect(runBaseScanLoop).toHaveBeenCalledWith(controller.signal, network, 'history');
    }
  },
);

it('does not scan after the shared shutdown signal has been aborted', async (): Promise<void> => {
  const controller = new AbortController();

  controller.abort();

  await runBaseWorker(controller.signal, ['testnet']);

  expect(runBaseScanLoop).not.toHaveBeenCalled();
});
