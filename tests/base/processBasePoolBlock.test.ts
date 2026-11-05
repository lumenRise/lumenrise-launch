import mongoose from 'mongoose';
import { toEventSelector } from 'viem';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import Launch from '../../src/models/Launch';
import BaseCursor from '../../src/models/BaseCursor';
import createBaseLog from '../helpers/createBaseLog';
import LaunchTrade from '../../src/models/LaunchTrade';
import BaseCheckpoint from '../../src/models/BaseCheckpoint';
import createBaseSwapLog from '../helpers/createBaseSwapLog';
import readBaseLaunch from '../../src/services/base/readBaseLaunch';
import type { BaseWriteContext } from '../../src/types/base/launch';
import processBaseBlock from '../../src/services/base/processBaseBlock';
import refreshBaseMarket from '../../src/services/base/refreshBaseMarket';
import { pool, asset, pair, curve, trader } from '../helpers/basePoolFixture';

vi.mock('../../src/services/base/refreshRecordedHoldings', () => ({ default: vi.fn() }));

vi.mock('../../src/logger', () => ({ default: { info: vi.fn() } }));

vi.mock('../../src/services/base/readBaseLaunch', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/refreshBaseMarket', () => ({ default: vi.fn() }));

const swap = createBaseSwapLog();
const event = { ...createBaseLog(), transactionIndex: swap.transactionIndex };

const launch = {
  contractId: curve,
  asset,
  pair,
  assetDecimals: 18,
  pairDecimals: 6,
  pool,
  state: { graduated: true },
};

const context = {
  leaseOwner: 'pool-worker',
  configuration: {
    network: 'testnet',
    factoryAddress: '0x3333333333333333333333333333333333333333',
  },
  client: {
    getBlock: vi.fn(),
    readContract: vi.fn(),
    getLogs: vi.fn(),
    getTransactionReceipt: vi.fn(),
  },
} as unknown as BaseWriteContext;

beforeEach((): void => {
  vi.clearAllMocks();

  vi.spyOn(LaunchTrade, 'exists').mockReturnValue({
    session: vi.fn().mockResolvedValue(null),
  } as never);

  vi.spyOn(mongoose.connection, 'transaction').mockImplementation(async (operation) =>
    operation({} as never),
  );

  vi.spyOn(BaseCursor, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);

  vi.spyOn(BaseCheckpoint, 'findOne').mockReturnValue({
    session: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }),
  } as never);

  vi.spyOn(BaseCheckpoint, 'updateOne').mockResolvedValue({} as never);

  vi.spyOn(Launch, 'findOne').mockReturnValue({
    session: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(launch) }),
  } as never);

  vi.spyOn(LaunchTrade, 'updateOne').mockResolvedValue({ upsertedCount: 1 } as never);

  vi.mocked(readBaseLaunch).mockResolvedValue({ pool } as never);

  vi.mocked(context.client.getBlock).mockResolvedValue({ hash: swap.blockHash } as never);

  vi.mocked(context.client.readContract).mockResolvedValue({ graduated: true } as never);

  vi.mocked(context.client.getLogs).mockResolvedValue([
    { transactionIndex: swap.transactionIndex },
  ] as never);

  vi.mocked(context.client.getTransactionReceipt).mockResolvedValue({
    status: 'success',
    transactionHash: swap.transactionHash,
    blockHash: swap.blockHash,
    from: trader,
  } as never);
});

afterEach((): void => {
  vi.restoreAllMocks();
});

it('records the final curve buy and same-block pool swap using the same format and replay keys', async (): Promise<void> => {
  const graduation = {
    ...swap,
    address: curve,
    topics: [toEventSelector('Graduated(uint256,uint256)')],
    logIndex: 2,
  };

  const input = {
    context,
    number: 20n,
    hash: swap.blockHash!,
    timestamp: 100n,
    logs: [swap, graduation, event],
  };

  await processBaseBlock(input);

  await processBaseBlock(input);

  const writes = vi.mocked(LaunchTrade.updateOne).mock.calls;

  expect(writes).toHaveLength(4);

  expect(writes[0]![0]).toEqual(writes[2]![0]);

  expect(writes[1]![0]).toEqual(writes[3]![0]);

  expect(writes[1]![1]).toMatchObject({
    $setOnInsert: { contractId: curve, trader, side: 'buy', grossAmount: '2000000' },
  });

  expect(vi.mocked(refreshBaseMarket).mock.calls[0]![1]).toBe(curve);

  expect(readBaseLaunch).not.toHaveBeenCalled();
});

it('ignores Swap events emitted outside the configured PoolManager', async (): Promise<void> => {
  await processBaseBlock({
    context,
    number: 20n,
    hash: swap.blockHash!,
    timestamp: 100n,
    logs: [{ ...swap, address: curve }],
  });

  expect(LaunchTrade.updateOne).not.toHaveBeenCalled();
});
