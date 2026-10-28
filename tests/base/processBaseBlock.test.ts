import mongoose from 'mongoose';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import Launch from '../../src/models/Launch';
import BaseCursor from '../../src/models/BaseCursor';
import createBaseLog from '../helpers/createBaseLog';
import LaunchTrade from '../../src/models/LaunchTrade';
import BaseCheckpoint from '../../src/models/BaseCheckpoint';
import type { BaseWriteContext } from '../../src/types/base/launch';
import processBaseBlock from '../../src/services/base/processBaseBlock';
import refreshBaseMarket from '../../src/services/base/refreshBaseMarket';

vi.mock('../../src/services/base/refreshBaseMarket', () => ({ default: vi.fn() }));

const event = createBaseLog();
const session = {};

const context = {
  leaseOwner: 'worker-one',
  configuration: {
    network: 'testnet',
    factoryAddress: '0x3333333333333333333333333333333333333333',
  },
  client: { getBlock: vi.fn() },
} as unknown as BaseWriteContext;

beforeEach((): void => {
  vi.clearAllMocks();

  vi.mocked(context.client.getBlock).mockResolvedValue({ hash: event.blockHash } as never);

  vi.spyOn(mongoose.connection, 'transaction').mockImplementation(async (operation) =>
    operation(session as never),
  );

  vi.spyOn(BaseCursor, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);

  vi.spyOn(BaseCheckpoint, 'findOne').mockReturnValue({
    session: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  } as never);

  vi.spyOn(BaseCheckpoint, 'updateOne').mockResolvedValue({} as never);

  vi.spyOn(Launch, 'findOne').mockReturnValue({
    session: vi.fn().mockReturnValue({
      lean: vi.fn().mockResolvedValue({ asset: 'token', assetDecimals: 18, pairDecimals: 6 }),
    }),
  } as never);

  vi.spyOn(LaunchTrade, 'updateOne').mockResolvedValue({} as never);
});

afterEach((): void => {
  vi.restoreAllMocks();
});

it('replays receipt and scanner ingestion with the same idempotency key', async (): Promise<void> => {
  const input = {
    context,
    number: 20n,
    hash: event.blockHash!,
    timestamp: 1_700_000_000n,
    logs: [event],
  };

  await processBaseBlock(input);

  await processBaseBlock({ ...input, advance: true });

  const calls = vi.mocked(LaunchTrade.updateOne).mock.calls;

  expect(calls).toHaveLength(2);

  expect(calls[0]?.[0]).toEqual(calls[1]?.[0]);

  expect(calls[0]?.[0]).toEqual({
    chain: 'base',
    network: 'testnet',
    transactionHash: event.transactionHash,
    operationIndex: 0,
  });

  expect(calls[0]?.[1]).toHaveProperty('$setOnInsert');

  expect(calls[0]?.[2]).toMatchObject({ upsert: true, session });

  expect(refreshBaseMarket).toHaveBeenCalledTimes(2);

  expect(BaseCursor.updateOne).toHaveBeenLastCalledWith(
    expect.objectContaining({ leaseOwner: 'worker-one' }),
    expect.objectContaining({ $set: expect.objectContaining({ nextBlock: '21' }) }),
    { session },
  );
});

it('stores multiple trades in the same transaction under distinct log indexes', async (): Promise<void> => {
  await processBaseBlock({
    context,
    number: 20n,
    hash: event.blockHash!,
    timestamp: 1n,
    logs: [createBaseLog(5), createBaseLog(2)],
  });

  expect(vi.mocked(LaunchTrade.updateOne).mock.calls.map((call) => call[0].operationIndex)).toEqual(
    [2, 5],
  );
});

it('ignores a trade emitter not indexed under the configured factory', async (): Promise<void> => {
  vi.mocked(Launch.findOne).mockReturnValue({
    session: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  } as never);

  await processBaseBlock({
    context,
    number: 20n,
    hash: event.blockHash!,
    timestamp: 1n,
    logs: [event],
  });

  expect(LaunchTrade.updateOne).not.toHaveBeenCalled();

  expect(refreshBaseMarket).not.toHaveBeenCalled();
});

it('does not write after losing the distributed lease', async (): Promise<void> => {
  vi.mocked(BaseCursor.updateOne).mockResolvedValue({ matchedCount: 0 } as never);

  await expect(
    processBaseBlock({
      context,
      number: 20n,
      hash: event.blockHash!,
      timestamp: 1n,
      logs: [event],
    }),
  ).rejects.toThrow('lease expired');

  expect(LaunchTrade.updateOne).not.toHaveBeenCalled();
});

it('rejects changed blocks and cross-block logs before starting a transaction', async (): Promise<void> => {
  vi.mocked(context.client.getBlock).mockResolvedValue({ hash: `0x${'c'.repeat(64)}` } as never);

  await expect(
    processBaseBlock({
      context,
      number: 20n,
      hash: event.blockHash!,
      timestamp: 1n,
      logs: [event],
    }),
  ).rejects.toThrow('changed');

  await expect(
    processBaseBlock({
      context,
      number: 21n,
      hash: event.blockHash!,
      timestamp: 1n,
      logs: [event],
    }),
  ).rejects.toThrow('differs');

  expect(mongoose.connection.transaction).not.toHaveBeenCalled();
});
