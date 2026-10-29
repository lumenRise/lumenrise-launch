import { beforeEach, expect, it, vi } from 'vitest';

import runBaseWorker from '../../src/services/base/runBaseWorker';
import scanBaseNetwork from '../../src/services/base/scanBaseNetwork';
import getBaseConfiguration from '../../src/services/base/getBaseConfiguration';
import initializeBaseLiveCursor from '../../src/services/base/initializeBaseLiveCursor';

vi.mock('../../src/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));
vi.mock('../../src/services/base/scanBaseNetwork', () => ({ default: vi.fn() }));
vi.mock('../../src/services/base/getBaseConfiguration', () => ({ default: vi.fn() }));
vi.mock('../../src/services/base/initializeBaseLiveCursor', () => ({ default: vi.fn() }));

beforeEach((): void => {
  vi.resetAllMocks();

  vi.mocked(initializeBaseLiveCursor).mockResolvedValue(true);
  vi.mocked(getBaseConfiguration).mockReturnValue({
    network: 'testnet',
    factoryAddress: 'factory',
  } as never);
});

it('receives live blocks while historical RPC retrieval is still blocked and drains both on shutdown', async (): Promise<void> => {
  const controller = new AbortController();
  let finishHistory: () => void = (): void => {};
  let liveReceived = false;

  const historical = new Promise<void>((resolve): void => {
    finishHistory = resolve;
  });

  vi.mocked(scanBaseNetwork).mockImplementation(async (_network, mode): Promise<void> => {
    if (mode === 'history') {
      await historical;

      return;
    }

    liveReceived = true;

    controller.abort();
  });

  let stopped = false;

  const worker = runBaseWorker(controller.signal, ['testnet']).then((): void => {
    stopped = true;
  });

  await vi.waitFor((): void => {
    expect(liveReceived).toBe(true);
  });

  expect(stopped).toBe(false);
  expect(scanBaseNetwork).toHaveBeenCalledWith('testnet', 'history');
  expect(scanBaseNetwork).toHaveBeenCalledWith('testnet', 'live');

  finishHistory();

  await worker;

  expect(stopped).toBe(true);
});
