import { beforeEach, expect, it, vi } from 'vitest';

import BaseCursor from '../../src/models/BaseCursor';
import getBaseContext from '../../src/services/base/getBaseContext';
import type { BaseWriteContext } from '../../src/types/base/launch';
import acquireBaseLease from '../../src/services/base/acquireBaseLease';
import releaseBaseLease from '../../src/services/base/releaseBaseLease';
import initializeBaseLiveCursor from '../../src/services/base/initializeBaseLiveCursor';

vi.mock('../../src/logger', () => ({ default: { info: vi.fn() } }));
vi.mock('../../src/models/BaseCursor', () => ({ default: { updateOne: vi.fn() } }));
vi.mock('../../src/services/base/getBaseContext', () => ({ default: vi.fn() }));
vi.mock('../../src/services/base/acquireBaseLease', () => ({ default: vi.fn() }));
vi.mock('../../src/services/base/releaseBaseLease', () => ({ default: vi.fn() }));

const context = {
  leaseOwner: 'writer',
  configuration: { factoryAddress: 'factory', deploymentBlock: 1n },
  client: { getBlockNumber: vi.fn() },
} as unknown as BaseWriteContext;

beforeEach((): void => {
  vi.resetAllMocks();

  vi.mocked(getBaseContext).mockResolvedValue(context);
  vi.mocked(acquireBaseLease).mockResolvedValue(context);
  vi.mocked(context.client.getBlockNumber).mockResolvedValue(100n);
  vi.mocked(BaseCursor.updateOne).mockResolvedValue({ matchedCount: 1 } as never);
});

it('starts at the current head and bounds catch-up without overwriting the historical cursor', async (): Promise<void> => {
  await expect(initializeBaseLiveCursor('testnet')).resolves.toBe(true);
  expect(BaseCursor.updateOne).toHaveBeenCalledWith(
    { network: 'testnet', factoryAddress: 'factory', leaseOwner: 'writer' },
    { $set: { nextLiveBlock: '100', historyEndBlock: '99' } },
  );
  expect(releaseBaseLease).toHaveBeenCalledWith(context);
});

it('waits for the shared writer instead of declaring live indexing initialized prematurely', async (): Promise<void> => {
  vi.mocked(acquireBaseLease).mockResolvedValue(null);

  await expect(initializeBaseLiveCursor('testnet')).resolves.toBe(false);
  expect(BaseCursor.updateOne).not.toHaveBeenCalled();
});
