import mongoose from 'mongoose';
import { expect, it, vi } from 'vitest';

import runBaseWorker from '../../src/services/base/runBaseWorker';

vi.mock('../../src/env', () => ({ default: {} }));

vi.mock('../../src/logger', () => ({ default: { info: vi.fn() } }));

it('exits without opening a database when Base has no deployment configuration', async (): Promise<void> => {
  const connect = vi.spyOn(mongoose, 'connect');

  try {
    await runBaseWorker();

    expect(connect).not.toHaveBeenCalled();
  } finally {
    connect.mockRestore();
  }
});
