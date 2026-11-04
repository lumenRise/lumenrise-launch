import { beforeEach, expect, it, vi } from 'vitest';

import Launch from '../../src/models/Launch';
import BaseCursor from '../../src/models/BaseCursor';
import createBaseLog from '../helpers/createBaseLog';
import { pool, curve, asset } from '../helpers/basePoolFixture';
import getBaseContext from '../../src/services/base/getBaseContext';
import getBaseRuntime from '../../src/services/base/getBaseRuntime';
import type { BaseWriteContext } from '../../src/types/base/launch';
import scanBaseNetwork from '../../src/services/base/scanBaseNetwork';
import acquireBaseLease from '../../src/services/base/acquireBaseLease';
import releaseBaseLease from '../../src/services/base/releaseBaseLease';
import processBaseBlock from '../../src/services/base/processBaseBlock';
import reconcileBaseChain from '../../src/services/base/reconcileBaseChain';

vi.mock('../../src/services/base/getBaseContext', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/acquireBaseLease', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/releaseBaseLease', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/processBaseBlock', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/reconcileBaseChain', () => ({ default: vi.fn() }));

vi.mock('../../src/models/Launch', () => ({
  default: { find: vi.fn(), exists: vi.fn(), updateOne: vi.fn() },
}));

vi.mock('../../src/models/BaseCursor', () => ({
  default: { findOne: vi.fn(), updateOne: vi.fn() },
}));

const event = createBaseLog();

const context = {
  leaseOwner: 'worker',
  configuration: {
    network: 'testnet',
    factoryAddress: '0x3333333333333333333333333333333333333333',
    batchSize: 1000n,
  },
  client: { getBlockNumber: vi.fn(), getBlock: vi.fn(), getLogs: vi.fn(), readContract: vi.fn() },
} as unknown as BaseWriteContext;

beforeEach((): void => {
  vi.resetAllMocks();

  const runtime = getBaseRuntime('testnet');

  runtime.head = 20n;

  runtime.blocks.clear();

  vi.mocked(Launch.exists).mockResolvedValue({ _id: 'pool' } as never);

  vi.mocked(getBaseContext).mockResolvedValue(context);

  vi.mocked(acquireBaseLease).mockResolvedValue(context);

  vi.mocked(BaseCursor.findOne).mockReturnValue({
    lean: async () => ({ nextBlock: '20', nextLiveBlock: '20', historyEndBlock: '20' }),
  } as never);

  vi.mocked(BaseCursor.updateOne).mockResolvedValue({ matchedCount: 1 } as never);

  vi.mocked(Launch.find).mockReturnValue({
    lean: async () => [{ contractId: curve, asset, state: {}, creationLedger: 1 }],
  } as never);

  vi.mocked(context.client.getLogs).mockResolvedValue([]);

  vi.mocked(context.client.getBlock).mockResolvedValue({
    number: 20n,
    hash: event.blockHash,
    timestamp: 100n,
  } as never);
});

it('combines the factory and known curves in one filtered request without a head or transfer request', async (): Promise<void> => {
  expect(await scanBaseNetwork('testnet', 'live')).toBe(true);

  expect(context.client.getLogs).toHaveBeenCalledTimes(1);

  expect(context.client.getLogs).toHaveBeenCalledWith(
    expect.objectContaining({
      address: [context.configuration.factoryAddress, curve],
      fromBlock: 20n,
      toBlock: 20n,
      events: expect.any(Array),
    }),
  );

  expect(context.client.getBlockNumber).not.toHaveBeenCalled();

  expect(context.client.readContract).not.toHaveBeenCalled();

  expect(reconcileBaseChain).toHaveBeenCalledTimes(1);

  expect(processBaseBlock).toHaveBeenCalledWith(
    expect.objectContaining({ verifiedBlock: true, coverageFrom: 21 }),
  );

  expect(releaseBaseLease).toHaveBeenCalled();
});

it('does not request any swaps without eligible pools', async (): Promise<void> => {
  expect(await scanBaseNetwork('testnet', 'pool')).toBe(true);

  expect(context.client.getLogs).not.toHaveBeenCalled();
});

it('filters swaps by the registered pool IDs and advances only eligible pool coverage', async (): Promise<void> => {
  vi.mocked(Launch.find).mockReturnValue({
    lean: async () => [
      {
        contractId: curve,
        asset,
        pool,
        state: { graduated: true },
        graduationBlock: 20,
        stateAsOfLedger: 20,
      },
    ],
  } as never);

  expect(await scanBaseNetwork('testnet', 'pool')).toBe(true);

  expect(context.client.getLogs).toHaveBeenCalledWith(
    expect.objectContaining({ address: pool.poolManager, args: { id: [pool.poolId] } }),
  );

  expect(Launch.updateOne).toHaveBeenCalledWith(expect.objectContaining({ contractId: curve }), {
    $set: { poolNextBlock: '21' },
  });
});

it('stops completed history without any log or head requests', async (): Promise<void> => {
  vi.mocked(BaseCursor.findOne).mockReturnValue({
    lean: async () => ({ nextBlock: '21', historyEndBlock: '20' }),
  } as never);

  expect(await scanBaseNetwork('testnet', 'history')).toBe(true);

  expect(context.client.getLogs).not.toHaveBeenCalled();

  expect(context.client.getBlockNumber).not.toHaveBeenCalled();

  expect(context.client.getBlock).not.toHaveBeenCalled();
});

it('does not ingest events before a launch registration coverage boundary', async (): Promise<void> => {
  vi.mocked(Launch.find).mockReturnValue({
    lean: async () => [{ contractId: curve, state: {}, tradeCoverageFrom: 21 }],
  } as never);

  vi.mocked(context.client.getLogs).mockResolvedValue([event] as never);

  await scanBaseNetwork('testnet', 'live');

  expect(processBaseBlock).toHaveBeenCalledWith(expect.objectContaining({ logs: [] }));
});

it('retains progress on log retrieval failure and releases the writer', async (): Promise<void> => {
  vi.mocked(context.client.getLogs).mockRejectedValue(new Error('RPC limit'));

  await expect(scanBaseNetwork('testnet', 'live')).rejects.toThrow('RPC limit');

  expect(processBaseBlock).not.toHaveBeenCalled();

  expect(releaseBaseLease).toHaveBeenCalled();
});

it('rejects a changed block before ingestion', async (): Promise<void> => {
  vi.mocked(context.client.getLogs).mockResolvedValue([event] as never);

  vi.mocked(context.client.getBlock).mockResolvedValue({ hash: 'changed' } as never);

  await expect(scanBaseNetwork('testnet', 'live')).rejects.toThrow('changed');

  expect(processBaseBlock).not.toHaveBeenCalled();
});

it('discards pre-reorganization work and reactivates historical processing', async (): Promise<void> => {
  vi.mocked(reconcileBaseChain).mockResolvedValue(true);

  getBaseRuntime('testnet').historyActive = false;

  expect(await scanBaseNetwork('testnet', 'live')).toBe(false);

  expect(getBaseRuntime('testnet').historyActive).toBe(true);

  expect(context.client.getLogs).not.toHaveBeenCalled();
});

it('uses bounded batches without obtaining another head', async (): Promise<void> => {
  getBaseRuntime('testnet').head = 2020n;

  vi.mocked(context.client.getBlock).mockResolvedValue({
    hash: event.blockHash,
    timestamp: 100n,
  } as never);

  expect(await scanBaseNetwork('testnet', 'live')).toBe(false);

  expect(context.client.getLogs).toHaveBeenCalledWith(
    expect.objectContaining({ fromBlock: 20n, toBlock: 1019n }),
  );

  expect(context.client.getBlockNumber).not.toHaveBeenCalled();
});
