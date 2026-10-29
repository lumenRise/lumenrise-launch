import { beforeEach, expect, it, vi } from 'vitest';

import BaseCursor from '../../src/models/BaseCursor';
import createBaseLog from '../helpers/createBaseLog';
import type { BaseWriteContext } from '../../src/types/base/launch';
import processBaseBlock from '../../src/services/base/processBaseBlock';
import acquireBaseLease from '../../src/services/base/acquireBaseLease';
import releaseBaseLease from '../../src/services/base/releaseBaseLease';
import reconcileBaseChain from '../../src/services/base/reconcileBaseChain';
import commitBaseScanBlock from '../../src/services/base/commitBaseScanBlock';
import recoverUnknownBaseLaunches from '../../src/services/base/recoverUnknownBaseLaunches';

vi.mock('../../src/models/BaseCursor', () => ({ default: { findOne: vi.fn() } }));
vi.mock('../../src/services/base/processBaseBlock', () => ({ default: vi.fn() }));
vi.mock('../../src/services/base/acquireBaseLease', () => ({ default: vi.fn() }));
vi.mock('../../src/services/base/releaseBaseLease', () => ({ default: vi.fn() }));
vi.mock('../../src/services/base/reconcileBaseChain', () => ({ default: vi.fn() }));
vi.mock('../../src/services/base/recoverUnknownBaseLaunches', () => ({ default: vi.fn() }));

const event = createBaseLog();
const context = {
  leaseOwner: 'writer',
  configuration: { network: 'testnet', factoryAddress: 'factory' },
} as BaseWriteContext;

const input = {
  number: 20n,
  hash: event.blockHash!,
  timestamp: 100n,
  logs: [event],
  advance: true,
  mode: 'live' as const,
  expectedNextBlock: '20',
};

beforeEach((): void => {
  vi.resetAllMocks();

  vi.mocked(acquireBaseLease).mockResolvedValue(context);
  vi.mocked(reconcileBaseChain).mockResolvedValue(false);
  vi.mocked(BaseCursor.findOne).mockReturnValue({
    lean: async () => ({ nextBlock: '1', nextLiveBlock: '20' }),
  } as never);
  vi.mocked(recoverUnknownBaseLaunches).mockResolvedValue([event]);
});

it('recovers missing launches before committing live trades and releases the block lease', async (): Promise<void> => {
  await expect(commitBaseScanBlock(context, input)).resolves.toBe(true);
  expect(vi.mocked(recoverUnknownBaseLaunches).mock.invocationCallOrder[0]).toBeLessThan(
    vi.mocked(processBaseBlock).mock.invocationCallOrder[0]!,
  );
  expect(releaseBaseLease).toHaveBeenCalledWith(context);
});

it('does not write stale batches after another scanner advanced the cursor', async (): Promise<void> => {
  vi.mocked(BaseCursor.findOne).mockReturnValue({
    lean: async () => ({ nextLiveBlock: '21' }),
  } as never);

  await expect(commitBaseScanBlock(context, input)).resolves.toBe(false);
  expect(processBaseBlock).not.toHaveBeenCalled();
  expect(releaseBaseLease).toHaveBeenCalled();
});

it('discards pre-reorg batches and lets both loops read their reset cursors', async (): Promise<void> => {
  vi.mocked(reconcileBaseChain).mockResolvedValue(true);

  await expect(commitBaseScanBlock(context, input)).resolves.toBe(false);
  expect(processBaseBlock).not.toHaveBeenCalled();
});

it('retains the cursor when launch recovery fails and releases the lease', async (): Promise<void> => {
  vi.mocked(recoverUnknownBaseLaunches).mockRejectedValue(new Error('Recovery unavailable'));

  await expect(commitBaseScanBlock(context, input)).rejects.toThrow('Recovery unavailable');
  expect(processBaseBlock).not.toHaveBeenCalled();
  expect(releaseBaseLease).toHaveBeenCalled();
});
