import mongoose from 'mongoose';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import Launch from '../../src/models/Launch';
import BaseCursor from '../../src/models/BaseCursor';
import LaunchName from '../../src/models/LaunchName';
import TokenImage from '../../src/models/TokenImage';
import LaunchTrade from '../../src/models/LaunchTrade';
import LaunchHolder from '../../src/models/LaunchHolder';
import BaseCheckpoint from '../../src/models/BaseCheckpoint';
import LaunchPriceSample from '../../src/models/LaunchPriceSample';
import type { BaseWriteContext } from '../../src/types/base/launch';
import refreshBaseMarket from '../../src/services/base/refreshBaseMarket';
import reconcileBaseChain from '../../src/services/base/reconcileBaseChain';

vi.mock('../../src/services/base/refreshBaseMarket', () => ({ default: vi.fn() }));

const stableHash = `0x${'a'.repeat(64)}`;
const orphanHash = `0x${'b'.repeat(64)}`;
const replacementHash = `0x${'c'.repeat(64)}`;
const session = {};

const context = {
  leaseOwner: 'worker-one',
  configuration: { network: 'testnet', factoryAddress: 'factory', deploymentBlock: 1n },
  client: { getBlock: vi.fn() },
} as unknown as BaseWriteContext;

beforeEach((): void => {
  vi.clearAllMocks();

  vi.mocked(context.client.getBlock)
    .mockResolvedValueOnce({ number: 10n, hash: stableHash, timestamp: 100n } as never)
    .mockResolvedValueOnce({ number: 20n, hash: replacementHash } as never)
    .mockResolvedValue({ number: 10n, hash: stableHash, timestamp: 100n } as never);

  vi.spyOn(mongoose.connection, 'transaction').mockImplementation(async (operation) =>
    operation(session as never),
  );

  vi.spyOn(BaseCursor, 'findOne').mockReturnValue({
    lean: vi.fn().mockResolvedValue({ nextBlock: '21' }),
  } as never);

  vi.spyOn(BaseCursor, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);

  vi.spyOn(BaseCheckpoint, 'find').mockReturnValue({
    sort: vi.fn().mockReturnValue({
      lean: vi
        .fn()
        .mockResolvedValue([{ _id: 'checkpoint', blockNumber: 20, blockHash: orphanHash }]),
    }),
  } as never);

  vi.spyOn(BaseCheckpoint, 'findOne').mockReturnValue({
    sort: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ blockNumber: 10, blockHash: stableHash }),
    }),
  } as never);

  vi.spyOn(BaseCheckpoint, 'updateOne').mockResolvedValue({} as never);

  vi.spyOn(BaseCheckpoint, 'deleteMany').mockResolvedValue({} as never);

  vi.spyOn(Launch, 'find')
    .mockReturnValueOnce({
      session: vi
        .fn()
        .mockReturnValue({ lean: vi.fn().mockResolvedValue([{ contractId: 'orphan-launch' }]) }),
    } as never)
    .mockReturnValue({
      session: vi
        .fn()
        .mockReturnValue({ lean: vi.fn().mockResolvedValue([{ contractId: 'survivor' }]) }),
    } as never);

  vi.spyOn(LaunchHolder, 'distinct').mockReturnValue({
    session: vi.fn().mockResolvedValue(['holder']),
  } as never);

  vi.spyOn(Launch, 'deleteMany').mockResolvedValue({} as never);

  vi.spyOn(LaunchTrade, 'deleteMany').mockResolvedValue({} as never);

  vi.spyOn(LaunchHolder, 'deleteMany').mockResolvedValue({} as never);

  vi.spyOn(LaunchPriceSample, 'deleteMany').mockResolvedValue({} as never);

  vi.spyOn(TokenImage, 'updateMany').mockResolvedValue({} as never);

  vi.spyOn(LaunchName, 'updateMany').mockResolvedValue({} as never);
});

afterEach((): void => {
  vi.restoreAllMocks();
});

it('atomically rewinds orphan trades, launches, prices, images and balances for Base only', async (): Promise<void> => {
  expect(await reconcileBaseChain(context)).toBe(true);

  expect(LaunchTrade.deleteMany).toHaveBeenCalledWith(
    { chain: 'base', network: 'testnet', ledger: { $gt: 10 } },
    { session },
  );

  expect(LaunchPriceSample.deleteMany).toHaveBeenCalledWith(
    { chain: 'base', network: 'testnet', ledger: { $gt: 10 } },
    { session },
  );

  expect(TokenImage.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({ chain: 'base', launchContractId: { $in: ['orphan-launch'] } }),
    expect.objectContaining({
      $set: expect.objectContaining({ status: 'pending', launchContractId: null }),
    }),
    { session },
  );

  expect(refreshBaseMarket).toHaveBeenCalledWith(
    expect.objectContaining({ session }),
    'survivor',
    10n,
    100n,
    ['holder'],
    true,
  );

  expect(BaseCursor.updateOne).toHaveBeenLastCalledWith(
    expect.objectContaining({ leaseOwner: 'worker-one' }),
    expect.objectContaining({
      $set: expect.objectContaining({ nextBlock: '11', previousBlockHash: stableHash }),
    }),
    { session },
  );
});

it('does not mistake an RPC failure for a chain reorganization', async (): Promise<void> => {
  vi.mocked(context.client.getBlock).mockReset().mockRejectedValue(new Error('RPC unavailable'));

  await expect(reconcileBaseChain(context)).rejects.toThrow('RPC unavailable');

  expect(mongoose.connection.transaction).not.toHaveBeenCalled();

  expect(LaunchTrade.deleteMany).not.toHaveBeenCalled();
});

it('does not advance the finalized recovery boundary over an unscanned receipt', async (): Promise<void> => {
  vi.mocked(context.client.getBlock)
    .mockReset()
    .mockResolvedValue({ number: 100n, hash: orphanHash } as never);

  vi.mocked(BaseCursor.findOne).mockReturnValue({
    lean: vi.fn().mockResolvedValue({ nextBlock: '5' }),
  } as never);

  expect(await reconcileBaseChain(context)).toBe(false);

  expect(BaseCheckpoint.updateOne).not.toHaveBeenCalled();
});
