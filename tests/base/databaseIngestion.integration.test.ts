import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import Launch from '../../src/models/Launch';
import BaseCursor from '../../src/models/BaseCursor';
import LaunchName from '../../src/models/LaunchName';
import TokenImage from '../../src/models/TokenImage';
import createBaseLog from '../helpers/createBaseLog';
import LaunchTrade from '../../src/models/LaunchTrade';
import LaunchHolder from '../../src/models/LaunchHolder';
import BaseCheckpoint from '../../src/models/BaseCheckpoint';
import LaunchPriceSample from '../../src/models/LaunchPriceSample';
import readBaseLaunch from '../../src/services/base/readBaseLaunch';
import type { BaseWriteContext } from '../../src/types/base/launch';
import createBaseCreationLog from '../helpers/createBaseCreationLog';
import processBaseBlock from '../../src/services/base/processBaseBlock';
import findBaseLaunchCreation from '../../src/services/base/findBaseLaunchCreation';
import recoverUnknownBaseLaunches from '../../src/services/base/recoverUnknownBaseLaunches';

vi.mock('../../src/logger', () => ({ default: { info: vi.fn() } }));
vi.mock('../../src/services/base/readBaseLaunch', () => ({ default: vi.fn() }));
vi.mock('../../src/services/base/findBaseLaunchCreation', () => ({ default: vi.fn() }));

const databaseName = `lumenrise_base_audit_${randomUUID().replaceAll('-', '')}`;
const oldHash = `0x${'2'.repeat(64)}` as const;
const currentHash = `0x${'3'.repeat(64)}` as const;
const curve = '0x1111111111111111111111111111111111111111';
const owner = '0x2222222222222222222222222222222222222222';
const factory = '0x3333333333333333333333333333333333333333';
const asset = '0x4444444444444444444444444444444444444444';
const pair = '0x5555555555555555555555555555555555555555';

const creation = { ...createBaseCreationLog(), blockHash: oldHash };
const currentTrade = { ...createBaseLog(), blockNumber: 100n, blockHash: currentHash };

const context = {
  leaseOwner: 'audit-writer',
  configuration: { network: 'testnet', factoryAddress: factory },
  client: { getBlock: vi.fn(), readContract: vi.fn(), getLogs: vi.fn() },
} as unknown as BaseWriteContext;

describe.runIf(Boolean(process.env.LUMENRISE_TEST_DB_URI))(
  'Base live and history database ingestion',
  (): void => {
    beforeAll(async (): Promise<void> => {
      await mongoose.connect(process.env.LUMENRISE_TEST_DB_URI!, {
        dbName: databaseName,
        serverSelectionTimeoutMS: 5000,
      });

      await Promise.all([
        Launch.createIndexes(),
        BaseCursor.createIndexes(),
        LaunchName.createIndexes(),
        TokenImage.createIndexes(),
        LaunchTrade.createIndexes(),
        LaunchHolder.createIndexes(),
        BaseCheckpoint.createIndexes(),
        LaunchPriceSample.createIndexes(),
      ]);

      await BaseCursor.create({
        network: 'testnet',
        factoryAddress: factory,
        nextBlock: '5',
        nextLiveBlock: '100',
        leaseOwner: context.leaseOwner,
        leaseUntil: new Date(Date.now() + 300_000),
      });

      vi.mocked(context.client.getBlock).mockImplementation(
        async (input) =>
          ({
            number: input!.blockNumber,
            hash: input!.blockNumber === 20n ? oldHash : currentHash,
            timestamp: input!.blockNumber,
          }) as never,
      );
      vi.mocked(context.client.getLogs).mockResolvedValue([]);

      vi.mocked(context.client.readContract).mockImplementation(async (input): Promise<never> => {
        if (input.functionName === 'launch_at') {
          return curve as never;
        }

        return (input.blockNumber === 100n ? 10n : 1n) as never;
      });

      vi.mocked(findBaseLaunchCreation).mockResolvedValue({
        asset,
        event: creation,
        number: 20n,
        hash: oldHash,
        timestamp: 20n,
      });

      vi.mocked(readBaseLaunch).mockImplementation(
        async (input) =>
          ({
            config: {
              total_supply: 1_000_000n * 10n ** 18n,
              params: {
                owner,
                asset,
                pair,
                metadata: {
                  name: 'Blue Project',
                  symbol: 'BLUE',
                  logo: 'https://images.example/blue.png',
                  description: '',
                },
              },
            },
            plainConfig: { params: {} },
            state: {
              sold: input.blockNumber === 100n ? '10' : '1',
              quote_reserve: '1',
              team_claimed: '0',
              buyer_count: 1,
              graduated: false,
            },
            price: 1n,
            assetDecimals: 18,
            pairDecimals: 6,
          }) as never,
      );
    });

    afterAll(async (): Promise<void> => {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });

    it('recovers an old launch before its current trade, preserves live state during history and deduplicates replay', async (): Promise<void> => {
      const logs = await recoverUnknownBaseLaunches(context, [currentTrade]);

      expect(await Launch.countDocuments()).toBe(1);
      expect(await LaunchTrade.countDocuments()).toBe(0);

      await processBaseBlock({
        context,
        number: 100n,
        hash: currentHash,
        timestamp: 100n,
        logs,
        advance: true,
        mode: 'live',
        expectedNextBlock: '100',
      });

      const liveCursor = await BaseCursor.findOne({ factoryAddress: factory }).lean();

      expect(liveCursor?.nextBlock).toBe('5');
      expect(liveCursor?.nextLiveBlock).toBe('101');

      const oldTrade = {
        ...createBaseLog(5),
        blockNumber: 20n,
        blockHash: oldHash,
        transactionHash: `0x${'b'.repeat(64)}` as const,
      };

      await processBaseBlock({
        context,
        number: 20n,
        hash: oldHash,
        timestamp: 20n,
        logs: [creation, oldTrade],
        advance: true,
        mode: 'history',
        expectedNextBlock: '5',
      });
      await processBaseBlock({
        context,
        number: 100n,
        hash: currentHash,
        timestamp: 100n,
        logs: [currentTrade],
      });

      const launch = await Launch.findOne({ contractId: curve }).lean();
      const cursor = await BaseCursor.findOne({ factoryAddress: factory }).lean();
      const holder = await LaunchHolder.findOne({ contractId: curve }).lean();

      expect(await Launch.countDocuments()).toBe(1);
      expect(await LaunchTrade.countDocuments()).toBe(2);
      expect(launch?.stateAsOfLedger).toBe(100);
      expect(launch?.state.sold).toBe('10');
      expect(holder?.observedBlock).toBe(100);
      expect(holder?.balance).toBe('10');
      expect(cursor?.nextBlock).toBe('21');
      expect(cursor?.nextLiveBlock).toBe('101');
    });
  },
);
