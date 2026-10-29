import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import log from '../../../src/logger';
import syncFactory from '../../../src/services/launch/syncFactory';
import { connectDatabase, disconnectDatabase } from '../../../src/db';
import runLaunchWorker from '../../../src/services/launch/runLaunchWorker';
import refreshLaunchState from '../../../src/services/launch/refreshLaunchState';
import createLaunchReader from '../../../src/services/stellar/createLaunchReader';
import syncAssetIdentities from '../../../src/services/stellar/syncAssetIdentities';
import finalizeTokenImages from '../../../src/services/tokenImage/finalizeTokenImages';
import { loadConfiguration } from '../../../src/services/configuration/loadConfiguration';

vi.mock('../../../src/env', () => ({
  default: { DB_URI: 'mongodb://localhost', DB_NAME: 'test' },
}));

vi.mock('../../../src/services/base/getBaseNetworks', () => ({ default: (): [] => [] }));

vi.mock('node:timers/promises', () => ({
  setTimeout: (milliseconds: number): Promise<void> =>
    new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    }),
}));

vi.mock('../../../src/services/network/getNetworkConfig', () => ({
  default: (network: string) => ({
    factoryContractId: network === 'testnet' ? 'testnet-factory' : '',
  }),
}));

vi.mock('../../../src/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../src/db', () => ({ connectDatabase: vi.fn(), disconnectDatabase: vi.fn() }));

vi.mock('../../../src/services/configuration/loadConfiguration', () => ({
  loadConfiguration: vi.fn(),
}));

vi.mock('../../../src/services/launch/createLaunchStore', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/launch/createLaunchIndexes', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/stellar/createLaunchReader', () => ({
  default: vi.fn().mockResolvedValue({ network: 'testnet' }),
}));

vi.mock('../../../src/services/launch/startLaunchHolderWorker', () => ({
  default: vi.fn().mockResolvedValue({ stop: vi.fn() }),
}));

vi.mock('../../../src/services/launch/syncFactory', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/launch/refreshLaunchState', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/tokenImage/finalizeTokenImages', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/tokenImage/markTokenImagesForCleanup', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/stellar/syncAssetIdentities', () => ({ default: vi.fn() }));

describe('launch worker timer coordination', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.useFakeTimers();

    vi.setSystemTime(new Date('2026-10-17T00:00:00Z'));

    vi.mocked(loadConfiguration).mockReturnValue({
      network: 'testnet',
      pollIntervalMs: 5000,
    } as never);

    vi.mocked(syncFactory).mockResolvedValue(0);

    vi.mocked(refreshLaunchState).mockResolvedValue(0);

    vi.mocked(finalizeTokenImages).mockResolvedValue(undefined);

    vi.mocked(syncAssetIdentities).mockResolvedValue(0);
  });

  afterEach(() => vi.useRealTimers());

  it('continues price polling while slow maintenance runs and drains it on shutdown', async () => {
    let finish: (value: number) => void = (): void => {};

    vi.mocked(syncAssetIdentities).mockImplementation(
      (): Promise<number> =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    vi.mocked(finalizeTokenImages).mockRejectedValue(new Error('storage down'));

    const running = runLaunchWorker();

    await vi.advanceTimersByTimeAsync(20_000);

    expect(connectDatabase).toHaveBeenCalledOnce();

    expect(loadConfiguration).toHaveBeenCalledOnce();

    expect(vi.mocked(loadConfiguration).mock.calls[0]?.[0]).toBe('testnet');

    expect(createLaunchReader).toHaveBeenCalledOnce();

    expect(syncAssetIdentities).toHaveBeenCalledOnce();

    expect(finalizeTokenImages).toHaveBeenCalledOnce();

    expect(refreshLaunchState.mock.calls.length).toBeGreaterThanOrEqual(4);

    process.emit('SIGTERM');

    await vi.advanceTimersByTimeAsync(5000);

    expect(disconnectDatabase).not.toHaveBeenCalled();

    finish(0);

    await running;

    expect(disconnectDatabase).toHaveBeenCalledOnce();

    const calls = refreshLaunchState.mock.calls.length;

    await vi.advanceTimersByTimeAsync(60_000);

    expect(refreshLaunchState).toHaveBeenCalledTimes(calls);
  });

  it('backs off factory failures without skipping price polls or finishing startup recovery', async () => {
    vi.mocked(syncFactory).mockRejectedValue(new Error('factory unavailable'));

    const running = runLaunchWorker();

    await vi.advanceTimersByTimeAsync(29_999);

    expect(syncFactory).toHaveBeenCalledTimes(1);

    expect(refreshLaunchState.mock.calls.length).toBeGreaterThanOrEqual(5);

    await vi.advanceTimersByTimeAsync(1);

    expect(syncFactory).toHaveBeenCalledTimes(2);

    expect(syncFactory.mock.calls.every((call) => call[3] === true)).toBe(true);

    process.emit('SIGTERM');

    await vi.advanceTimersByTimeAsync(5000);

    await running;

    expect(disconnectDatabase).toHaveBeenCalledOnce();
  });

  it('logs the failed network and error and disconnects after startup failure', async (): Promise<void> => {
    const error = new Error('RPC unavailable');

    vi.mocked(loadConfiguration).mockReturnValue({
      network: 'testnet',
      pollIntervalMs: 5000,
    } as never);

    vi.mocked(createLaunchReader).mockRejectedValueOnce(error);

    await expect(runLaunchWorker()).rejects.toBe(error);

    expect(log.error).toHaveBeenCalledWith(
      { err: error, network: 'testnet' },
      'Launch network worker failed',
    );

    expect(disconnectDatabase).toHaveBeenCalledOnce();
  });
});
