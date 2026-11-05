import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { encodeAbiParameters, encodeEventTopics } from 'viem';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import Launch from '../../src/models/Launch';
import BaseCursor from '../../src/models/BaseCursor';
import LaunchName from '../../src/models/LaunchName';
import TokenImage from '../../src/models/TokenImage';
import createBaseLog from '../helpers/createBaseLog';
import LaunchTrade from '../../src/models/LaunchTrade';
import tokenAbi from '../../src/constants/base/tokenAbi';
import LaunchHolder from '../../src/models/LaunchHolder';
import { pool, trader } from '../helpers/basePoolFixture';
import BaseCheckpoint from '../../src/models/BaseCheckpoint';
import createBaseSwapLog from '../helpers/createBaseSwapLog';
import LaunchPriceSample from '../../src/models/LaunchPriceSample';
import getBaseContext from '../../src/services/base/getBaseContext';
import getBaseRuntime from '../../src/services/base/getBaseRuntime';
import readBaseLaunch from '../../src/services/base/readBaseLaunch';
import createBaseCreationLog from '../helpers/createBaseCreationLog';
import BaseTransactionJob from '../../src/models/BaseTransactionJob';
import createOptimizedLaunch from '../helpers/createOptimizedLaunch';
import scanBaseNetwork from '../../src/services/base/scanBaseNetwork';
import type { BaseContext } from '../../src/types/base/configuration';
import processBaseBlock from '../../src/services/base/processBaseBlock';
import acquireBaseLease from '../../src/services/base/acquireBaseLease';
import releaseBaseLease from '../../src/services/base/releaseBaseLease';
import reconcileBaseChain from '../../src/services/base/reconcileBaseChain';
import processBaseTransactionJob from '../../src/workers/processBaseTransactionJob';
import refreshRecordedHoldings from '../../src/services/base/refreshRecordedHoldings';

vi.mock('../../src/logger', () => ({ default: { info: vi.fn(), warn: vi.fn() } }));

vi.mock('../../src/services/base/getBaseContext', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/readBaseLaunch', () => ({ default: vi.fn() }));

const databaseName = `rpc_optimized_${randomUUID().replaceAll('-', '')}`;
const launch = createOptimizedLaunch();
const event = createBaseLog();

const context = {
  configuration: {
    network: 'testnet',
    factoryAddress: launch.factoryContractId,
    deploymentBlock: 1n,
    batchSize: 1000n,
    rpcUrl: 'https://rpc.example',
  },
  client: {
    getBlock: vi.fn(),
    getLogs: vi.fn(),
    readContract: vi.fn(),
    getBlockNumber: vi.fn(),
    getTransactionReceipt: vi.fn(),
  },
} as unknown as BaseContext;

const models = [
  Launch,
  BaseCursor,
  LaunchName,
  TokenImage,
  LaunchTrade,
  LaunchHolder,
  BaseCheckpoint,
  LaunchPriceSample,
  BaseTransactionJob,
];

describe.runIf(Boolean(process.env.LUMENRISE_TEST_DB_URI))(
  'optimized Base database ingestion',
  (): void => {
    beforeAll(async (): Promise<void> => {
      await mongoose.connect(process.env.LUMENRISE_TEST_DB_URI!, { dbName: databaseName });

      for (const model of models) {
        await model.createIndexes();
      }
    });

    beforeEach(async (): Promise<void> => {
      vi.resetAllMocks();

      for (const model of models) {
        await model.deleteMany({});
      }

      await Launch.create(launch);

      await BaseCursor.create({
        network: 'testnet',
        factoryAddress: launch.factoryContractId,
        nextBlock: '20',
        nextLiveBlock: '20',
        historyEndBlock: '19',
      });

      getBaseRuntime('testnet').head = 20n;

      getBaseRuntime('testnet').blocks.clear();

      vi.mocked(getBaseContext).mockResolvedValue(context);

      vi.mocked(context.client.getBlock).mockImplementation(
        async (request): Promise<never> =>
          ({
            number: request?.blockTag === 'finalized' ? 10n : (request?.blockNumber ?? 20n),
            hash: event.blockHash,
            timestamp: 100n,
          }) as never,
      );

      vi.mocked(context.client.getLogs).mockResolvedValue([]);

      vi.mocked(readBaseLaunch).mockResolvedValue({
        state: { graduated: false },
        price: 1n,
        pool: null,
        graduationState: null,
      } as never);
    });

    afterAll(async (): Promise<void> => {
      await mongoose.connection.dropDatabase();

      await mongoose.disconnect();
    });

    it('ingests a known curve trade once, derives holdings, and avoids all token balance RPC reads', async (): Promise<void> => {
      vi.mocked(context.client.getLogs).mockResolvedValue([event] as never);

      expect(await scanBaseNetwork('testnet', 'live')).toBe(true);

      expect(await scanBaseNetwork('testnet', 'live')).toBe(true);

      expect(await LaunchTrade.countDocuments({})).toBe(1);

      const trade = await LaunchTrade.findOne().lean();
      const holder = await LaunchHolder.findOne().lean();

      expect(holder?.balance).toBe(trade?.assetAmount);

      expect(holder?.balanceSource).toBe('recorded_trades');

      expect(context.client.readContract).not.toHaveBeenCalled();

      expect(readBaseLaunch).toHaveBeenCalledTimes(1);

      expect(context.client.getBlockNumber).not.toHaveBeenCalled();

      expect(context.client.getLogs).toHaveBeenCalledTimes(1);
    });

    it('does not refresh holders or market state for unrelated token transfer logs', async (): Promise<void> => {
      const writer = await acquireBaseLease(context);

      expect(writer).not.toBeNull();

      try {
        await processBaseBlock({
          context: writer!,
          number: 20n,
          hash: event.blockHash!,
          timestamp: 100n,
          logs: [
            {
              ...event,
              address: launch.asset as `0x${string}`,
              topics: encodeEventTopics({
                abi: tokenAbi,
                eventName: 'Transfer',
                args: { from: trader, to: '0x6666666666666666666666666666666666666666' },
              }),
              data: encodeAbiParameters([{ type: 'uint256' }], [20n]),
            },
          ],
        });
      } finally {
        await releaseBaseLease(writer!);
      }

      expect(await LaunchHolder.countDocuments({})).toBe(0);

      expect(context.client.readContract).not.toHaveBeenCalled();

      expect(readBaseLaunch).not.toHaveBeenCalled();
    });

    it('rebuilds signed net trade quantities without carrying over old wallet snapshots', async (): Promise<void> => {
      await LaunchHolder.create({
        chain: 'base',
        network: 'testnet',
        contractId: launch.contractId,
        address: trader,
        asset: launch.asset,
        balance: '999',
        balanceSort: '999'.padStart(39, '0'),
        observedAt: new Date(),
      });

      await LaunchTrade.create({
        chain: 'base',
        network: 'testnet',
        contractId: launch.contractId,
        transactionHash: event.transactionHash,
        operationIndex: 0,
        transactionIndex: 0,
        ledger: 20,
        tradedAt: new Date(),
        trader,
        side: 'sell',
        assetAmount: '7',
        grossAmount: '1',
        executionPrice: '1',
      });

      const writer = await acquireBaseLease(context);

      try {
        await mongoose.connection.transaction(async (session): Promise<void> => {
          await refreshRecordedHoldings({ ...writer!, session }, launch.contractId);
        });
      } finally {
        await releaseBaseLease(writer!);
      }

      expect(await LaunchHolder.findOne().lean()).toMatchObject({
        balance: '0',
        netRecordedAmount: '-7',
      });

      expect(context.client.readContract).not.toHaveBeenCalled();
    });

    it('processes durable API trade jobs promptly and returns their result without scanner discovery', async (): Promise<void> => {
      vi.mocked(context.client.getTransactionReceipt).mockResolvedValue({
        status: 'success',
        transactionHash: event.transactionHash,
        blockNumber: 20n,
        blockHash: event.blockHash,
        logs: [event],
        from: trader,
      } as never);

      const job = await BaseTransactionJob.create({
        network: 'testnet',
        action: 'trade',
        contractId: launch.contractId,
        transactionHash: event.transactionHash,
      });

      await processBaseTransactionJob('testnet', job._id.toString());

      await processBaseTransactionJob('testnet', job._id.toString());

      expect(await BaseTransactionJob.findById(job._id).lean()).toMatchObject({
        status: 'completed',
        result: { trade: { side: 'buy' } },
      });

      expect(await LaunchTrade.countDocuments({})).toBe(1);

      expect(context.client.getLogs).not.toHaveBeenCalled();

      expect(context.client.getTransactionReceipt).toHaveBeenCalledTimes(1);
    });

    it('keeps transient failures retryable without advancing scan progress', async (): Promise<void> => {
      vi.mocked(context.client.getTransactionReceipt).mockRejectedValue(
        new Error('Receipt not available'),
      );

      const job = await BaseTransactionJob.create({
        network: 'testnet',
        action: 'trade',
        contractId: launch.contractId,
        transactionHash: event.transactionHash,
      });

      await processBaseTransactionJob('testnet', job._id.toString());

      expect(await BaseTransactionJob.findById(job._id).lean()).toMatchObject({
        status: 'queued',
        attempts: 1,
      });

      expect((await BaseCursor.findOne().lean())?.nextLiveBlock).toBe('20');
    });

    it('does not scan the PoolManager before any project has a pool', async (): Promise<void> => {
      expect(await scanBaseNetwork('testnet', 'pool')).toBe(true);

      expect(context.client.getLogs).not.toHaveBeenCalled();
    });

    it('filters a graduated pool, attributes swaps to the receipt sender, and stops scanning its old curve', async (): Promise<void> => {
      const swap = createBaseSwapLog();

      await Launch.updateOne(
        { contractId: launch.contractId },
        { $set: { state: { graduated: true }, pool, graduationBlock: 19, poolNextBlock: '20' } },
      );

      vi.mocked(context.client.getLogs).mockResolvedValue([swap] as never);

      vi.mocked(context.client.getTransactionReceipt).mockResolvedValue({
        status: 'success',
        transactionHash: swap.transactionHash,
        blockHash: swap.blockHash,
        from: trader,
      } as never);

      vi.mocked(readBaseLaunch).mockResolvedValue({
        state: { graduated: true },
        pool,
        price: 1n,
      } as never);

      expect(await scanBaseNetwork('testnet', 'pool')).toBe(true);

      expect(await LaunchTrade.findOne().lean()).toMatchObject({ trader, side: 'buy' });

      expect(context.client.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({ args: { id: [pool.poolId] } }),
      );

      vi.mocked(context.client.getLogs).mockResolvedValue([]);

      await scanBaseNetwork('testnet', 'live');

      expect(context.client.getLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ address: [launch.factoryContractId] }),
      );
    });

    it('rewinds trades, derived amounts, completed jobs, and cursors after a block changes', async (): Promise<void> => {
      vi.mocked(context.client.getLogs).mockResolvedValue([event] as never);

      await scanBaseNetwork('testnet', 'live');

      await BaseCheckpoint.create({
        network: 'testnet',
        factoryAddress: launch.factoryContractId,
        blockNumber: 10,
        blockHash: event.blockHash,
        finalized: true,
      });

      await BaseTransactionJob.create({
        network: 'testnet',
        action: 'trade',
        contractId: launch.contractId,
        transactionHash: event.transactionHash,
        status: 'completed',
        observedBlock: 20,
        result: { trade: {} },
      });

      vi.mocked(context.client.getBlock).mockImplementation(
        async (request): Promise<never> =>
          ({
            number: request?.blockNumber ?? 10n,
            hash: request?.blockNumber === 20n ? `0x${'f'.repeat(64)}` : event.blockHash,
            timestamp: 100n,
          }) as never,
      );

      const writer = await acquireBaseLease(context);

      try {
        expect(await reconcileBaseChain(writer!)).toBe(true);
      } finally {
        await releaseBaseLease(writer!);
      }

      expect(await LaunchTrade.countDocuments({})).toBe(0);

      expect(await LaunchHolder.countDocuments({})).toBe(0);

      expect(await BaseTransactionJob.findOne().lean()).toMatchObject({
        status: 'queued',
        result: null,
      });

      expect(await BaseCursor.findOne().lean()).toMatchObject({
        nextLiveBlock: '11',
        nextBlock: '11',
      });

      expect(context.client.readContract).not.toHaveBeenCalled();
    });

    it('registers a late-discovered launch without fetching its pre-registration trades', async (): Promise<void> => {
      await Launch.deleteMany({});

      const creation = createBaseCreationLog();

      vi.mocked(context.client.getLogs).mockResolvedValue([creation] as never);

      vi.mocked(context.client.readContract).mockResolvedValue(launch.contractId as never);

      vi.mocked(readBaseLaunch).mockResolvedValue({
        config: {
          total_supply: 1_000_000n * 10n ** 18n,
          params: {
            owner: launch.owner,
            asset: launch.asset,
            pair: launch.pair,
            metadata: launch.metadata,
          },
        },
        plainConfig: {},
        state: { graduated: false },
        price: 1n,
        assetDecimals: 18,
        pairDecimals: 6,
      } as never);

      expect(await scanBaseNetwork('testnet', 'live')).toBe(true);

      expect(await Launch.findOne().lean()).toMatchObject({
        tradeCoverageFrom: 21,
        contractId: launch.contractId,
      });

      expect(await LaunchPriceSample.countDocuments({})).toBe(1);

      expect(context.client.getLogs).toHaveBeenCalledTimes(1);

      expect(context.client.getLogs).toHaveBeenCalledWith(
        expect.objectContaining({ address: [launch.factoryContractId] }),
      );

      expect(await LaunchTrade.countDocuments({})).toBe(0);
    });
  },
);
