import mongoose from 'mongoose';
import { expect, it, vi } from 'vitest';

import runBaseWorker from '../../src/services/base/runBaseWorker';
import getBaseNetworks from '../../src/services/base/getBaseNetworks';

vi.mock('../../src/env', () => ({ default: {} }));

vi.mock('../../src/logger', () => ({ default: { info: vi.fn() } }));

it('leaves the shared database lifecycle untouched when Base is unconfigured', async (): Promise<void> => {
  const connect = vi.spyOn(mongoose, 'connect');
  const disconnect = vi.spyOn(mongoose, 'disconnect');
  const controller = new AbortController();
  const networks = getBaseNetworks();

  try {
    await runBaseWorker(controller.signal, networks);

    expect(networks).toEqual([]);
    expect(connect).not.toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});
