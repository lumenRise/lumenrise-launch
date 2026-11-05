import { expect, it, vi } from 'vitest';

import Launch from '../src/models/Launch';
import LaunchTrade from '../src/models/LaunchTrade';
import getStatsChart from '../src/services/stats/getStatsChart';

vi.mock('../src/models/Launch', () => ({ default: { find: vi.fn() } }));

vi.mock('../src/models/LaunchTrade', () => ({ default: { find: vi.fn() } }));

it('builds six zero-filled activity series with clipped UTC buckets and exact volumes', async (): Promise<void> => {
  const now = new Date('2026-11-01T12:00:00Z');
  const from = new Date('2026-10-29T12:00:00Z');
  const close = vi.fn();

  const launches = [
    { chain: 'stellar', network: 'testnet', contractId: 'same', createdAt: from },
    {
      chain: 'base',
      network: 'testnet',
      contractId: 'same',
      assetDecimals: 18,
      pairDecimals: 6,
      createdAt: from,
    },
    {
      chain: 'stellar',
      network: 'public',
      contractId: 'same',
      createdAt: new Date('2026-10-31T00:00:00Z'),
    },
    {
      chain: 'base',
      network: 'public',
      contractId: 'same',
      assetDecimals: 18,
      pairDecimals: 18,
      createdAt: null,
    },
    {
      chain: 'stellar',
      network: 'testnet',
      contractId: 'older',
      createdAt: new Date('2026-10-01T00:00:00Z'),
    },
    { chain: 'stellar', network: 'testnet', contractId: 'exclusive-end', createdAt: now },
  ];

  const records = [
    {
      chain: 'stellar',
      network: 'testnet',
      contractId: 'same',
      tradedAt: from,
      trader: 'WALLET',
      side: 'buy',
      grossAmount: '10000000',
    },
    {
      chain: 'stellar',
      network: 'testnet',
      contractId: 'older',
      tradedAt: from,
      trader: 'WALLET',
      side: 'sell',
      grossAmount: '10000000',
    },
    {
      chain: 'base',
      network: 'testnet',
      contractId: 'same',
      tradedAt: from,
      trader: '0xABC',
      side: 'buy',
      grossAmount: '1000000',
    },
    {
      chain: 'base',
      network: 'testnet',
      contractId: 'same',
      tradedAt: from,
      trader: '0xabc',
      side: 'sell',
      grossAmount: '1000000',
    },
    {
      chain: 'stellar',
      network: 'public',
      contractId: 'same',
      tradedAt: new Date('2026-10-31T00:00:00Z'),
      trader: 'WALLET',
      side: 'sell',
      grossAmount: '10000000',
    },
    {
      chain: 'base',
      network: 'public',
      contractId: 'same',
      tradedAt: new Date('2026-10-31T00:00:00Z'),
      trader: '0xabc',
      side: 'buy',
      grossAmount: '9007199254740993000000000000000001',
    },
  ];

  vi.mocked(Launch.find).mockReturnValue({
    select: () => ({ lean: async () => launches }),
  } as never);

  vi.mocked(LaunchTrade.find).mockReturnValue({
    select: () => ({
      lean: () => ({ cursor: () => ({ [Symbol.asyncIterator]: () => records.values(), close }) }),
    }),
  } as never);

  const result = await getStatsChart({ from, to: now, interval: 'day' }, now);

  expect(LaunchTrade.find).toHaveBeenCalledWith({
    network: { $in: ['testnet', 'public'] },
    tradedAt: { $gte: from, $lt: now },
  });

  expect(result.chains).toHaveLength(4);

  expect(result.combined).toHaveLength(2);

  expect(result.combined[0]?.items).toHaveLength(4);

  expect(result.combined[0]?.items[0]).toEqual({
    timestamp: from.toISOString(),
    endsAt: '2026-10-30T00:00:00.000Z',
    launchCount: 2,
    tradeCount: 4,
    buyCount: 2,
    sellCount: 2,
    volume: '8',
    participantCount: 2,
  });

  expect(result.chains[0]?.items[0]).toMatchObject({
    launchCount: 1,
    tradeCount: 2,
    volume: '4',
    participantCount: 1,
  });

  expect(result.chains[1]?.items[0]).toMatchObject({
    launchCount: 1,
    tradeCount: 2,
    volume: '4',
    participantCount: 1,
  });

  expect(result.combined[0]?.items[1]).toMatchObject({
    launchCount: 0,
    tradeCount: 0,
    volume: '0',
    participantCount: 0,
  });

  expect(result.combined[1]?.items[2]).toMatchObject({
    launchCount: 1,
    tradeCount: 2,
    volume: '18014398509481988.000000000000000002',
    participantCount: 2,
  });

  expect(result.combined[0]?.items[3]?.endsAt).toBe(now.toISOString());

  expect(close).toHaveBeenCalledOnce();

  records[0]!.grossAmount = '-1';

  await expect(getStatsChart({ from, to: now, interval: 'day' }, now)).rejects.toThrow(
    'Trade chart data is invalid',
  );

  expect(close).toHaveBeenCalledTimes(2);
});
