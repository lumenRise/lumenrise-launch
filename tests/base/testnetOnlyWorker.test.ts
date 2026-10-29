import { afterEach, expect, it, vi } from 'vitest';

import runBaseWorker from '../../src/services/base/runBaseWorker';
import getBaseNetworks from '../../src/services/base/getBaseNetworks';
import scanBaseNetwork from '../../src/services/base/scanBaseNetwork';
import getBaseConfiguration from '../../src/services/base/getBaseConfiguration';

vi.mock('../../src/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));

vi.mock('../../src/services/base/getBaseConfiguration', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/scanBaseNetwork', () => ({ default: vi.fn() }));

afterEach((): void => {
  vi.resetAllMocks();
});

it('never reads mainnet configuration or scans public Base at shared startup', async (): Promise<void> => {
  const controller = new AbortController();

  vi.mocked(getBaseConfiguration).mockImplementation((network) => {
    if (network === 'public') {
      throw new Error('Mainnet must not be configured or checked');
    }

    return { network: 'testnet' } as never;
  });

  vi.mocked(scanBaseNetwork).mockImplementation(async (): Promise<void> => {
    controller.abort();
  });

  await runBaseWorker(controller.signal, getBaseNetworks());

  expect(getBaseConfiguration).toHaveBeenCalledTimes(2);
  expect(getBaseConfiguration.mock.calls.every(([network]) => network === 'testnet')).toBe(true);
  expect(scanBaseNetwork).toHaveBeenCalledExactlyOnceWith('testnet');
});

it('does not scan after the shared shutdown signal has been aborted', async (): Promise<void> => {
  const controller = new AbortController();

  controller.abort();

  await runBaseWorker(controller.signal, ['testnet']);

  expect(scanBaseNetwork).not.toHaveBeenCalled();
});
