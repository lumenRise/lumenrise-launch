import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import runBaseWorker from '../../../src/services/base/runBaseWorker';
import { connectDatabase, disconnectDatabase } from '../../../src/db';
import getBaseNetworks from '../../../src/services/base/getBaseNetworks';
import runLaunchWorker from '../../../src/services/launch/runLaunchWorker';
import runNetworkWorker from '../../../src/services/launch/runNetworkWorker';
import getNetworkConfig from '../../../src/services/network/getNetworkConfig';
import createLaunchIndexes from '../../../src/services/launch/createLaunchIndexes';
import { loadConfiguration } from '../../../src/services/configuration/loadConfiguration';

vi.mock('../../../src/env', () => ({
  default: { DB_URI: 'mongodb://localhost', DB_NAME: 'test' },
}));

vi.mock('../../../src/logger', () => ({ default: { info: vi.fn(), error: vi.fn() } }));

vi.mock('../../../src/db', () => ({ connectDatabase: vi.fn(), disconnectDatabase: vi.fn() }));

vi.mock('../../../src/services/base/runBaseWorker', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/base/getBaseNetworks', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/launch/runNetworkWorker', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/network/getNetworkConfig', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/launch/createLaunchIndexes', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/configuration/loadConfiguration', () => ({
  loadConfiguration: vi.fn(),
}));

beforeEach((): void => {
  vi.resetAllMocks();

  vi.mocked(getNetworkConfig).mockImplementation(
    (network) => ({ factoryContractId: network === 'testnet' ? 'factory' : '' }) as never,
  );

  vi.mocked(getBaseNetworks).mockReturnValue(['testnet']);

  vi.mocked(runBaseWorker).mockResolvedValue();
  vi.mocked(runNetworkWorker).mockResolvedValue();

  vi.mocked(loadConfiguration).mockReturnValue({
    network: 'testnet',
    dbUri: 'mongodb://localhost',
    dbName: 'test',
  } as never);
});

afterEach((): void => {
  vi.restoreAllMocks();
});

it('starts both chains concurrently and disconnects only after both have drained', async (): Promise<void> => {
  let finishStellar: () => void = (): void => {};
  let finishBase: () => void = (): void => {};

  vi.mocked(runNetworkWorker).mockImplementation(
    (): Promise<void> =>
      new Promise((resolve) => {
        finishStellar = resolve;
      }),
  );

  vi.mocked(runBaseWorker).mockImplementation(
    (): Promise<void> =>
      new Promise((resolve) => {
        finishBase = resolve;
      }),
  );

  const running = runLaunchWorker();

  await vi.waitFor((): void => {
    expect(runNetworkWorker).toHaveBeenCalledOnce();
    expect(runBaseWorker).toHaveBeenCalledOnce();
  });

  const signal = vi.mocked(runBaseWorker).mock.calls[0]![0];

  expect(vi.mocked(runNetworkWorker).mock.calls[0]![1]).toBe(signal);
  expect(connectDatabase).toHaveBeenCalledOnce();
  expect(createLaunchIndexes).toHaveBeenCalledOnce();

  process.emit('SIGTERM');
  finishBase();

  await Promise.resolve();

  expect(signal.aborted).toBe(true);
  expect(disconnectDatabase).not.toHaveBeenCalled();

  finishStellar();

  await running;

  expect(disconnectDatabase).toHaveBeenCalledOnce();
});

it('aborts and drains Stellar when the Base worker fails', async (): Promise<void> => {
  const failure = new Error('Base startup failed');
  const initialListeners = process.listenerCount('SIGTERM');

  vi.mocked(runNetworkWorker).mockImplementation(async (_configuration, signal): Promise<void> => {
    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', (): void => resolve(), { once: true });
    });
  });

  vi.mocked(runBaseWorker).mockRejectedValue(failure);

  await expect(runLaunchWorker()).rejects.toBe(failure);

  expect(disconnectDatabase).toHaveBeenCalledOnce();
  expect(process.listenerCount('SIGTERM')).toBe(initialListeners);
});

it('can run Base without a configured Stellar factory using the same database connection', async (): Promise<void> => {
  vi.mocked(getNetworkConfig).mockReturnValue({ factoryContractId: '' } as never);

  await runLaunchWorker();

  expect(connectDatabase).toHaveBeenCalledExactlyOnceWith({
    dbUri: 'mongodb://localhost',
    dbName: 'test',
  });
  expect(runNetworkWorker).not.toHaveBeenCalled();
  expect(runBaseWorker).toHaveBeenCalledOnce();
  expect(disconnectDatabase).toHaveBeenCalledOnce();
});

it('keeps Stellar running without starting an unconfigured Base loop', async (): Promise<void> => {
  vi.mocked(getBaseNetworks).mockReturnValue([]);

  await runLaunchWorker();

  expect(runNetworkWorker).toHaveBeenCalledOnce();
  expect(runBaseWorker).not.toHaveBeenCalled();
  expect(connectDatabase).toHaveBeenCalledOnce();
  expect(disconnectDatabase).toHaveBeenCalledOnce();
});

it('cleans up signal listeners when connecting to the database fails', async (): Promise<void> => {
  const failure = new Error('Database unavailable');
  const initialListeners = process.listenerCount('SIGTERM');

  vi.mocked(connectDatabase).mockRejectedValue(failure);

  await expect(runLaunchWorker()).rejects.toBe(failure);

  expect(runBaseWorker).not.toHaveBeenCalled();
  expect(runNetworkWorker).not.toHaveBeenCalled();
  expect(disconnectDatabase).toHaveBeenCalledOnce();
  expect(process.listenerCount('SIGTERM')).toBe(initialListeners);
});

it('aborts and drains Base when a Stellar network fails', async (): Promise<void> => {
  const failure = new Error('Stellar startup failed');
  let sharedSignal: AbortSignal | undefined;

  vi.mocked(runNetworkWorker).mockRejectedValue(failure);

  vi.mocked(runBaseWorker).mockImplementation(async (signal): Promise<void> => {
    sharedSignal = signal;

    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', (): void => resolve(), { once: true });
    });
  });

  await expect(runLaunchWorker()).rejects.toBe(failure);

  expect(sharedSignal?.aborted).toBe(true);
  expect(disconnectDatabase).toHaveBeenCalledOnce();
});
