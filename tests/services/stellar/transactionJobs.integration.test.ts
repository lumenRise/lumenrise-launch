import mongoose from 'mongoose';
import { randomUUID } from 'node:crypto';
import { StrKey } from '@stellar/stellar-sdk';
import { beforeAll, beforeEach, afterAll, describe, expect, it, vi } from 'vitest';

import Launch from '../../../src/models/Launch';
import LaunchTrade from '../../../src/models/LaunchTrade';
import LaunchHolder from '../../../src/models/LaunchHolder';
import LaunchPriceSample from '../../../src/models/LaunchPriceSample';
import getStellarRpc from '../../../src/services/stellar/getStellarRpc';
import createOptimizedLaunch from '../../helpers/createOptimizedLaunch';
import StellarTransactionJob from '../../../src/models/StellarTransactionJob';
import getNetworkConfig from '../../../src/services/network/getNetworkConfig';
import readLaunchContract from '../../../src/services/stellar/readLaunchContract';
import decodeLaunchCreation from '../../../src/utils/launch/decodeLaunchCreation';
import recordStellarLaunch from '../../../src/services/launch/recordStellarLaunch';
import decodeTradeTransaction from '../../../src/utils/launch/decodeTradeTransaction';
import refreshStellarHoldings from '../../../src/services/stellar/refreshStellarHoldings';
import rebuildStellarHoldings from '../../../src/services/stellar/rebuildStellarHoldings';
import processStellarTransactionJob from '../../../src/workers/processStellarTransactionJob';

vi.mock('../../../src/logger', () => ({ default: { info: vi.fn(), warn: vi.fn() } }));

vi.mock('../../../src/services/stellar/getStellarRpc', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/stellar/readLaunchContract', () => ({ default: vi.fn() }));

vi.mock('../../../src/utils/launch/decodeTradeTransaction', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/launch/recordStellarLaunch', () => ({ default: vi.fn() }));

vi.mock('../../../src/utils/launch/decodeLaunchCreation', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/network/getNetworkConfig', () => ({ default: vi.fn() }));

const contractId = StrKey.encodeContract(Buffer.alloc(32, 2));
const trader = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 5));
const identity = { chain: 'stellar' as const, network: 'testnet' as const, contractId };
const transactionHash = 'a'.repeat(64);
const server = { getTransaction: vi.fn() };
const models = [Launch, LaunchTrade, LaunchHolder, LaunchPriceSample, StellarTransactionJob];

const launch = createOptimizedLaunch({
  ...identity,
  factoryContractId: 'factory',
  asset: 'asset',
  pair: 'pair',
  config: { params: { starts_at: '1' } },
  state: { sold: '0', graduated: false },
  priceAsOfLedger: 0,
});

const trade = {
  ...identity,
  transactionHash,
  operationIndex: 0,
  transactionIndex: 1,
  ledger: 100,
  tradedAt: new Date(),
  trader,
  side: 'buy' as const,
  assetAmount: '9007199254740993',
  grossAmount: '10000000',
  executionPrice: '1',
};

const job = {
  network: 'testnet',
  action: 'trade',
  transactionHash,
  contractId,
  status: 'queued',
  scheduledAt: new Date(0),
};

describe.runIf(Boolean(process.env.LUMENRISE_TEST_DB_URI))(
  'Stellar durable processing and recorded holdings',
  (): void => {
    beforeAll(async (): Promise<void> => {
      await mongoose.connect(process.env.LUMENRISE_TEST_DB_URI!, {
        dbName: `stellar_optimized_${randomUUID().replaceAll('-', '')}`,
      });

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

      vi.mocked(getStellarRpc).mockReturnValue(server as never);

      vi.mocked(getNetworkConfig).mockReturnValue({ factoryContractId: 'factory' } as never);

      server.getTransaction.mockResolvedValue({
        status: 'SUCCESS',
        txHash: transactionHash,
        ledger: 100,
      });

      vi.mocked(decodeTradeTransaction).mockReturnValue(trade);

      vi.mocked(readLaunchContract).mockImplementation(async (_server, _contract, method) => ({
        value:
          method === 'get_state'
            ? {
                sold: 10n,
                quote_reserve: 1n,
                team_claimed: 0n,
                creator_fees: 0n,
                buyer_count: 1,
                graduated: false,
              }
            : 10n,
        ledger: 101,
      }));
    });

    afterAll(async (): Promise<void> => {
      await mongoose.connection.dropDatabase();

      await mongoose.disconnect();
    });

    it('commits verified trades, market data, exact case-sensitive holdings and completed status', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create(job);

      await processStellarTransactionJob('testnet', queued.id);

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('completed');

      expect(await LaunchTrade.countDocuments(identity)).toBe(1);

      expect(await LaunchHolder.findOne(identity).lean()).toMatchObject({
        address: trader,
        balance: trade.assetAmount,
        balanceSource: 'recorded_trades',
      });

      expect(await Launch.findOne(identity).lean()).toMatchObject({
        priceAsOfLedger: 101,
        holderSource: 'recorded_trades',
      });

      expect(readLaunchContract).toHaveBeenCalledTimes(2);

      expect(server.getTransaction).toHaveBeenCalledTimes(1);
    });

    it('does not re-read completed jobs and deduplicates replayed transactions', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create(job);

      await processStellarTransactionJob('testnet', queued.id);

      await processStellarTransactionJob('testnet', queued.id);

      await StellarTransactionJob.updateOne(
        { _id: queued._id },
        { $set: { status: 'queued', scheduledAt: new Date(0) } },
      );

      await processStellarTransactionJob('testnet', queued.id);

      expect(await LaunchTrade.countDocuments(identity)).toBe(1);

      expect((await LaunchHolder.findOne(identity))?.balance).toBe(trade.assetAmount);

      expect(server.getTransaction).toHaveBeenCalledTimes(1);

      expect(readLaunchContract).toHaveBeenCalledTimes(2);
    });

    it('recovers accepted jobs without a broker message and retries unavailable evidence', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create(job);

      server.getTransaction.mockResolvedValueOnce({ status: 'NOT_FOUND' });

      await processStellarTransactionJob('testnet');

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('queued');

      expect(await LaunchTrade.countDocuments()).toBe(0);

      await StellarTransactionJob.updateOne(
        { _id: queued._id },
        { $set: { scheduledAt: new Date(0) } },
      );

      await processStellarTransactionJob('testnet');

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('completed');
    });

    it('rolls back domain writes when market evidence is stale and succeeds on retry', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create(job);

      vi.mocked(readLaunchContract).mockResolvedValueOnce({ value: {}, ledger: 99 });

      await processStellarTransactionJob('testnet', queued.id);

      expect(await LaunchTrade.countDocuments()).toBe(0);

      expect(await LaunchHolder.countDocuments()).toBe(0);

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('queued');

      await StellarTransactionJob.updateOne(
        { _id: queued._id },
        { $set: { scheduledAt: new Date(0) } },
      );

      await processStellarTransactionJob('testnet', queued.id);

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('completed');
    });

    it('rejects failed transactions permanently and retries mismatched provider hashes', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create(job);

      server.getTransaction.mockResolvedValueOnce({ status: 'FAILED', txHash: transactionHash });

      await processStellarTransactionJob('testnet', queued.id);

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('failed');

      await StellarTransactionJob.updateOne(
        { _id: queued._id },
        { $set: { status: 'queued', scheduledAt: new Date(0) } },
      );

      server.getTransaction.mockResolvedValueOnce({ status: 'SUCCESS', txHash: 'b'.repeat(64) });

      await processStellarTransactionJob('testnet', queued.id);

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('queued');

      expect(await LaunchTrade.countDocuments()).toBe(0);
    });

    it('reuses persisted same-ledger market observations for another trade', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create(job);

      await processStellarTransactionJob('testnet', queued.id);

      const nextHash = 'b'.repeat(64);

      server.getTransaction.mockResolvedValue({ status: 'SUCCESS', txHash: nextHash, ledger: 101 });

      vi.mocked(decodeTradeTransaction).mockReturnValue({
        ...trade,
        transactionHash: nextHash,
        ledger: 101,
        side: 'sell',
        assetAmount: '1',
      });

      await StellarTransactionJob.create({ ...job, transactionHash: nextHash });

      await processStellarTransactionJob('testnet');

      expect(readLaunchContract).toHaveBeenCalledTimes(2);

      expect((await LaunchHolder.findOne(identity))?.balance).toBe('9007199254740992');
    });

    it('rebuilds previous balance snapshots from trades without RPC and preserves signed deficits', async (): Promise<void> => {
      await LaunchHolder.create({
        ...identity,
        address: trader,
        asset: 'asset',
        balance: '999',
        balanceSort: '999'.padStart(39, '0'),
        observedAt: new Date(),
      });

      await LaunchTrade.create({ ...trade, side: 'sell', assetAmount: '10' });

      await rebuildStellarHoldings('testnet');

      expect(await LaunchHolder.findOne(identity).lean()).toMatchObject({
        address: trader,
        balance: '0',
        netRecordedAmount: '-10',
        balanceSource: 'recorded_trades',
      });

      expect(server.getTransaction).not.toHaveBeenCalled();

      expect(readLaunchContract).not.toHaveBeenCalled();

      await LaunchTrade.deleteMany(identity);

      await mongoose.connection.transaction(async (session): Promise<void> => {
        await refreshStellarHoldings(identity, session);
      });

      expect(await LaunchHolder.countDocuments(identity)).toBe(0);
    });

    it('recovers expired running jobs and keeps chain and network scopes isolated', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create({
        ...job,
        status: 'running',
        leaseUntil: new Date(0),
      });

      await StellarTransactionJob.create({ ...job, network: 'public' });

      await processStellarTransactionJob('testnet');

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('completed');

      expect((await StellarTransactionJob.findOne({ network: 'public' }))?.status).toBe('queued');

      expect(await LaunchHolder.countDocuments({ chain: 'base' })).toBe(0);
    });

    it('serializes concurrent trade rebuilds without losing either holder contribution', async (): Promise<void> => {
      const nextHash = 'b'.repeat(64);
      const otherTrader = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 6));
      const first = await StellarTransactionJob.create(job);
      const second = await StellarTransactionJob.create({ ...job, transactionHash: nextHash });

      server.getTransaction.mockImplementation(async (hash: string) => ({
        status: 'SUCCESS',
        txHash: hash,
        ledger: 100,
      }));

      vi.mocked(decodeTradeTransaction).mockImplementation((transaction) => ({
        ...trade,
        transactionHash: transaction.txHash,
        trader: transaction.txHash === transactionHash ? trader : otherTrader,
      }));

      await Promise.all([
        processStellarTransactionJob('testnet', first.id),
        processStellarTransactionJob('testnet', second.id),
      ]);

      // A conflicting upsert can be scheduled for retry; drain that durable state too.
      await StellarTransactionJob.updateMany(
        { status: 'queued' },
        { $set: { scheduledAt: new Date(0) } },
      );

      await processStellarTransactionJob('testnet');

      expect(await StellarTransactionJob.countDocuments({ status: 'completed' })).toBe(2);

      expect(await LaunchTrade.countDocuments(identity)).toBe(2);

      expect(await LaunchHolder.countDocuments(identity)).toBe(2);

      expect((await LaunchHolder.find(identity).lean()).map((holder) => holder.balance)).toEqual([
        trade.assetAmount,
        trade.assetAmount,
      ]);
    });

    it('processes launch confirmations in the worker and preserves name-conflict status', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create({
        ...job,
        action: 'launch',
        contractId: 'factory',
      });

      vi.mocked(decodeLaunchCreation).mockReturnValue(contractId);

      vi.mocked(recordStellarLaunch).mockResolvedValue(launch);

      await processStellarTransactionJob('testnet', queued.id);

      expect((await StellarTransactionJob.findById(queued.id))?.result).toMatchObject({
        launchContracts: [contractId],
      });

      expect(recordStellarLaunch).toHaveBeenCalledOnce();

      await StellarTransactionJob.updateOne(
        { _id: queued._id },
        { $set: { status: 'queued', scheduledAt: new Date(0) } },
      );

      const conflict = new Error('Name reserved');

      conflict.name = 'LaunchNameConflict';

      vi.mocked(recordStellarLaunch).mockRejectedValue(conflict);

      await processStellarTransactionJob('testnet', queued.id);

      expect(await StellarTransactionJob.findById(queued.id).lean()).toMatchObject({
        status: 'failed',
        failureStatus: 409,
      });
    });

    it.each([
      [0, 4000],
      [1, 8000],
      [2, 16000],
      [3, 32000],
      [4, 60000],
      [18, 60000],
    ])(
      'schedules retry after %i prior attempts with a %i ms delay',
      async (attempts, delay): Promise<void> => {
        const queued = await StellarTransactionJob.create({
          ...job,
          attempts,
          notFoundAttempts: Math.min(attempts, 4),
        });

        const started = Date.now();

        server.getTransaction.mockResolvedValueOnce({ status: 'NOT_FOUND' });

        await processStellarTransactionJob('testnet', queued.id);

        const saved = await StellarTransactionJob.findById(queued.id);

        expect(saved?.status).toBe('queued');

        expect(saved?.attempts).toBe(attempts + 1);

        expect(saved?.scheduledAt.getTime()).toBeGreaterThanOrEqual(started + delay);

        expect(saved?.scheduledAt.getTime()).toBeLessThanOrEqual(Date.now() + delay);
      },
    );

    it('stops after six NOT_FOUND responses without another RPC read', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create({
        ...job,
        attempts: 5,
        notFoundAttempts: 5,
      });

      server.getTransaction.mockResolvedValueOnce({ status: 'NOT_FOUND' });

      await processStellarTransactionJob('testnet', queued.id);

      await processStellarTransactionJob('testnet', queued.id);

      const saved = await StellarTransactionJob.findById(queued.id);

      expect(saved?.status).toBe('failed');

      expect(saved?.attempts).toBe(6);

      expect(saved?.notFoundAttempts).toBe(6);

      expect(saved?.lastError).toBe('Transaction not available yet');

      expect(saved?.leaseUntil).toBeNull();

      expect(server.getTransaction).toHaveBeenCalledOnce();
    });

    it('allows successful processing on the final permitted attempt', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create({ ...job, attempts: 19 });

      await processStellarTransactionJob('testnet', queued.id);

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('completed');

      expect((await StellarTransactionJob.findById(queued.id))?.attempts).toBe(20);

      expect(server.getTransaction).toHaveBeenCalledOnce();
    });

    it.each(['queued', 'running'])(
      'retires exhausted %s jobs without an RPC read',
      async (status): Promise<void> => {
        const queued = await StellarTransactionJob.create({
          ...job,
          status,
          attempts: status === 'queued' ? 886 : 20,
          leaseUntil: status === 'running' ? new Date(0) : null,
          lastError: 'Transaction not available yet',
        });

        await processStellarTransactionJob('testnet');

        const saved = await StellarTransactionJob.findById(queued.id);

        expect(saved?.status).toBe('failed');

        expect(saved?.attempts).toBe(status === 'queued' ? 886 : 20);

        expect(saved?.lastError).toBe('Transaction not available yet');

        expect(server.getTransaction).not.toHaveBeenCalled();
      },
    );

    it('does not retire a final attempt with an active lease', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create({
        ...job,
        status: 'running',
        attempts: 20,
        leaseUntil: new Date(Date.now() + 300000),
      });

      await processStellarTransactionJob('testnet');

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('running');

      expect(server.getTransaction).not.toHaveBeenCalled();
    });

    it('keeps RPC failures outside the six NOT_FOUND responses across retries', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create({
        ...job,
        attempts: 15,
        notFoundAttempts: 4,
      });

      server.getTransaction.mockRejectedValueOnce(new Error('RPC request timed out'));

      await processStellarTransactionJob('testnet', queued.id);

      expect(await StellarTransactionJob.findById(queued.id).lean()).toMatchObject({
        status: 'queued',
        attempts: 16,
        notFoundAttempts: 4,
      });

      await StellarTransactionJob.updateOne(
        { _id: queued._id },
        { $set: { scheduledAt: new Date(0) } },
      );

      server.getTransaction.mockResolvedValueOnce({ status: 'NOT_FOUND' });

      await processStellarTransactionJob('testnet', queued.id);

      expect(await StellarTransactionJob.findById(queued.id).lean()).toMatchObject({
        status: 'queued',
        attempts: 17,
        notFoundAttempts: 5,
      });

      await StellarTransactionJob.updateOne(
        { _id: queued._id },
        { $set: { scheduledAt: new Date(0) } },
      );

      server.getTransaction.mockResolvedValueOnce({ status: 'NOT_FOUND' });

      await processStellarTransactionJob('testnet', queued.id);

      expect(await StellarTransactionJob.findById(queued.id).lean()).toMatchObject({
        status: 'failed',
        attempts: 18,
        notFoundAttempts: 6,
      });
    });

    it('retains the general twenty-attempt cap for RPC connection failures', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create({
        ...job,
        attempts: 19,
        notFoundAttempts: 0,
      });

      server.getTransaction.mockRejectedValueOnce(new Error('Connection refused'));

      await processStellarTransactionJob('testnet', queued.id);

      expect(await StellarTransactionJob.findById(queued.id).lean()).toMatchObject({
        status: 'failed',
        attempts: 20,
        notFoundAttempts: 0,
      });
    });

    it('retires an exhausted NOT_FOUND job with an expired lease without reading RPC', async (): Promise<void> => {
      const queued = await StellarTransactionJob.create({
        ...job,
        status: 'running',
        attempts: 6,
        notFoundAttempts: 6,
        leaseUntil: new Date(0),
      });

      await processStellarTransactionJob('testnet', queued.id);

      expect((await StellarTransactionJob.findById(queued.id))?.status).toBe('failed');

      expect(server.getTransaction).not.toHaveBeenCalled();
    });
  },
);
