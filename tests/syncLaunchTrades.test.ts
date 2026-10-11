import { StrKey } from '@stellar/stellar-sdk';
import type { rpc } from '@stellar/stellar-sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Launch from '../src/store/Launch';
import LaunchTrade from '../src/store/LaunchTrade';
import syncLaunchTrades from '../src/syncLaunchTrades';
import LaunchTradeCursor from '../src/store/LaunchTradeCursor';
import type { Configuration } from '../src/types/configuration';
import decodeTradeTransaction from '../src/chain/decodeTradeTransaction';

vi.mock('../src/store/Launch', () => ({
  default: { aggregate: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../src/store/LaunchTrade', () => ({
  default: { exists: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('../src/store/LaunchTradeCursor', () => ({
  default: { findOne: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('../src/chain/decodeTradeTransaction', () => ({ default: vi.fn() }));
const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));
const asset = StrKey.encodeContract(Buffer.alloc(32, 2));
const config = { network: 'testnet' } as Configuration;
const now = new Date('2026-10-11T01:00:00Z');
const reader = () => ({
  getHealth: vi.fn().mockResolvedValue({ oldestLedger: 100, latestLedger: 200 }),
  getEvents: vi.fn().mockResolvedValue({
    events: [],
    cursor: 'page',
    latestLedger: 200,
    oldestLedgerCloseTime: '1791680000',
  }),
  getTransaction: vi.fn().mockResolvedValue({ status: 'SUCCESS' }),
});

describe('bounded durable trade ingestion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(Launch.aggregate).mockResolvedValue([{ contractId }]);
    vi.mocked(LaunchTradeCursor.updateOne).mockResolvedValue({
      matchedCount: 1,
      upsertedCount: 1,
    } as never);
    vi.mocked(Launch.findOne).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ network: 'testnet', contractId, asset }),
    } as never);
  });
  it('filters the launch asset, starts at retained history and advances an empty page', async () => {
    const server = reader();
    await syncLaunchTrades(server as unknown as rpc.Server, config, now);
    expect(server.getEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        startLedger: 100,
        limit: 5,
        filters: [expect.objectContaining({ contractIds: [asset] })],
      }),
    );
    expect(server.getTransaction).not.toHaveBeenCalled();
    expect(LaunchTradeCursor.updateOne).toHaveBeenLastCalledWith(
      { network: 'testnet', contractId },
      expect.objectContaining({
        $set: expect.objectContaining({
          cursor: 'page',
          nextLedger: 200,
          scannedThroughLedger: 200,
          coverageFrom: new Date(1791680000 * 1000),
          historyGap: false,
        }),
      }),
    );
  });
  it('deduplicates a transaction before making another RPC request', async () => {
    const server = reader();
    server.getEvents.mockResolvedValue({
      events: [
        { txHash: 'hash', ledger: 150 },
        { txHash: 'hash', ledger: 150 },
      ],
      cursor: 'page',
      latestLedger: 200,
      oldestLedgerCloseTime: '1791680000',
    } as never);
    vi.mocked(LaunchTrade.exists).mockResolvedValue({ _id: 'known' } as never);
    await syncLaunchTrades(server as unknown as rpc.Server, config, now);
    expect(LaunchTrade.exists).toHaveBeenCalledTimes(1);
    expect(server.getTransaction).not.toHaveBeenCalled();
  });
  it('does not repeat RPC when another worker owns the cursor lease', async () => {
    vi.mocked(LaunchTradeCursor.updateOne).mockResolvedValue({
      matchedCount: 0,
      upsertedCount: 0,
    } as never);
    const server = reader();
    expect(await syncLaunchTrades(server as unknown as rpc.Server, config, now)).toBe(0);
    expect(server.getHealth).not.toHaveBeenCalled();
    expect(server.getEvents).not.toHaveBeenCalled();
  });
  it('retains the cursor if evidence or writing is unavailable', async () => {
    const server = reader();
    server.getEvents.mockResolvedValue({
      events: [{ txHash: 'hash', ledger: 150 }],
      cursor: 'next',
      latestLedger: 200,
    } as never);
    server.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });
    await expect(syncLaunchTrades(server as unknown as rpc.Server, config, now)).rejects.toThrow(
      'retaining cursor',
    );
    expect(LaunchTradeCursor.updateOne).toHaveBeenCalledTimes(1);
    server.getTransaction.mockResolvedValue({ status: 'SUCCESS' });
    vi.mocked(decodeTradeTransaction).mockReturnValue({
      operationIndex: 0,
    } as never);
    vi.mocked(LaunchTrade.updateOne).mockRejectedValue(new Error('write failed'));
    await expect(syncLaunchTrades(server as unknown as rpc.Server, config, now)).rejects.toThrow(
      'write failed',
    );
  });
  it('resets an expired cursor and marks a coverage gap', async () => {
    vi.mocked(Launch.aggregate).mockResolvedValue([]);
    vi.mocked(LaunchTradeCursor.findOne).mockReturnValue({
      sort: () => ({
        lean: async () => ({
          contractId,
          cursor: 'expired',
          nextLedger: 50,
          coverageFrom: new Date('2026-10-01T00:00:00Z'),
          historyGap: false,
        }),
      }),
    } as never);
    const server = reader();
    await syncLaunchTrades(server as unknown as rpc.Server, config, now);
    expect(server.getEvents).toHaveBeenCalledWith(expect.objectContaining({ startLedger: 100 }));
    expect(LaunchTradeCursor.updateOne).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({
        $set: expect.objectContaining({
          historyGap: true,
          coverageFrom: new Date('2026-10-01T00:00:00Z'),
        }),
      }),
    );
  });
});
