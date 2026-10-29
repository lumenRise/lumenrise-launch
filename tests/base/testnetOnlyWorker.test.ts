import mongoose from 'mongoose';
import { afterEach, expect, it, vi } from 'vitest';

import BaseCursor from '../../src/models/BaseCursor';
import BaseCheckpoint from '../../src/models/BaseCheckpoint';
import runBaseWorker from '../../src/services/base/runBaseWorker';
import scanBaseNetwork from '../../src/services/base/scanBaseNetwork';
import getBaseConfiguration from '../../src/services/base/getBaseConfiguration';

vi.mock('../../src/env', () => ({
  default: {
    DB_URI: 'mongodb://localhost',
    DB_NAME: 'test',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../src/services/base/getBaseConfiguration', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/scanBaseNetwork', () => ({ default: vi.fn() }));

afterEach((): void => {
  vi.restoreAllMocks();
  vi.resetAllMocks();
});

it('never reads mainnet configuration or scans public Base at worker startup', async (): Promise<void> => {
  vi.mocked(getBaseConfiguration).mockImplementation((network) => {
    if (network === 'public') {
      throw new Error('Mainnet must not be configured or checked');
    }

    return { network: 'testnet' } as never;
  });

  vi.mocked(scanBaseNetwork).mockImplementation(async (): Promise<void> => {
    process.emit('SIGTERM');
  });

  vi.spyOn(mongoose, 'connect').mockResolvedValue(mongoose);
  vi.spyOn(mongoose, 'disconnect').mockResolvedValue();
  vi.spyOn(BaseCursor, 'createIndexes').mockResolvedValue([]);
  vi.spyOn(BaseCheckpoint, 'createIndexes').mockResolvedValue([]);

  await runBaseWorker();

  expect(getBaseConfiguration).toHaveBeenCalledExactlyOnceWith('testnet');
  expect(scanBaseNetwork).toHaveBeenCalledExactlyOnceWith('testnet');
  expect(mongoose.disconnect).toHaveBeenCalledOnce();
});
