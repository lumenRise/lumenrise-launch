import { expect, it, vi } from 'vitest';

import Launch from '../src/models/Launch';
import LaunchTrade from '../src/models/LaunchTrade';
import getMarketStats from '../src/services/stats/getMarketStats';

vi.mock('../src/models/Launch', () => ({ default: { find: vi.fn() } }));

vi.mock('../src/models/LaunchTrade', () => ({ default: { find: vi.fn() } }));

it('reports six isolated groups with exact doubled volumes, distinct traders, empty launches and global users', async (): Promise<void> => {
  const now = new Date('2026-11-01T12:00:00Z');
  const close = vi.fn();

  const launches = [
    { chain: 'stellar', network: 'testnet', contractId: 'same', slug: 'stellar-test' },
    { chain: 'stellar', network: 'testnet', contractId: 'empty', slug: 'empty' },
    { chain: 'stellar', network: 'public', contractId: 'same', slug: 'stellar-main' },
    {
      chain: 'base',
      network: 'testnet',
      contractId: 'same',
      slug: 'base-test',
      assetDecimals: 18,
      pairDecimals: 6,
    },
    {
      chain: 'base',
      network: 'testnet',
      contractId: 'second',
      slug: 'second',
      assetDecimals: 18,
      pairDecimals: 6,
    },
    {
      chain: 'base',
      network: 'public',
      contractId: 'same',
      slug: 'base-main',
      assetDecimals: 18,
      pairDecimals: 18,
    },
  ];

  const records = [
    {
      chain: 'stellar',
      network: 'testnet',
      contractId: 'same',
      grossAmount: '10000000',
      trader: 'WALLET',
      side: 'buy',
    },
    {
      chain: 'stellar',
      network: 'testnet',
      contractId: 'same',
      grossAmount: '10000000',
      trader: 'WALLET',
      side: 'sell',
    },
    {
      chain: 'stellar',
      network: 'public',
      contractId: 'same',
      grossAmount: '20000000',
      trader: 'WALLET',
      side: 'sell',
    },
    {
      chain: 'base',
      network: 'testnet',
      contractId: 'same',
      grossAmount: '1000000',
      trader: '0xABC',
      side: 'buy',
    },
    {
      chain: 'base',
      network: 'testnet',
      contractId: 'same',
      grossAmount: '1000000',
      trader: '0xabc',
      side: 'sell',
    },
    {
      chain: 'base',
      network: 'testnet',
      contractId: 'second',
      grossAmount: '1000000',
      trader: '0xabc',
      side: 'buy',
    },
    {
      chain: 'base',
      network: 'public',
      contractId: 'same',
      grossAmount: '9007199254740993000000000000000001',
      trader: '0xabc',
      side: 'buy',
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

  const result = await getMarketStats(now, 7);

  expect(result.chains).toHaveLength(4);

  expect(result.combined).toHaveLength(2);

  expect(result.userCountScope).toBe('global_active_identities');

  expect(LaunchTrade.find).toHaveBeenCalledWith({ tradedAt: { $lte: now } });

  expect(close).toHaveBeenCalledOnce();

  expect(result.chains[0]).toMatchObject({
    chain: 'stellar',
    network: 'testnet',
    launchCount: 2,
    participantCount: 1,
    userCount: 7,
    volumeTotal: { amount: '4', tradeCount: 2, buyCount: 1, sellCount: 1 },
  });

  expect(result.chains[0]?.launches[1]).toMatchObject({
    contractId: 'empty',
    participantCount: 0,
    volumeTotal: { amount: '0', tradeCount: 0 },
  });

  expect(result.chains[1]).toMatchObject({
    chain: 'base',
    network: 'testnet',
    launchCount: 2,
    participantCount: 1,
    volumeTotal: { amount: '6', tradeCount: 3 },
  });

  expect(result.combined[0]).toMatchObject({
    network: 'testnet',
    launchCount: 4,
    participantCount: 2,
    userCount: 7,
    volumeTotal: { amount: '10', tradeCount: 5 },
  });

  expect(result.combined[1]).toMatchObject({
    network: 'public',
    launchCount: 2,
    participantCount: 2,
    volumeTotal: { amount: '18014398509481990.000000000000000002', tradeCount: 2 },
  });

  records.push({
    chain: 'base',
    network: 'testnet',
    contractId: 'missing',
    grossAmount: '1',
    trader: '0xabc',
    side: 'buy',
  });

  await expect(getMarketStats(now, 7)).rejects.toThrow('invalid market statistics data');

  expect(close).toHaveBeenCalledTimes(2);

  records.pop();

  records[0]!.grossAmount = '-1';

  await expect(getMarketStats(now, 7)).rejects.toThrow('invalid market statistics data');

  expect(close).toHaveBeenCalledTimes(3);

  records.length = 0;

  launches.length = 0;

  const empty = await getMarketStats(now, 7);

  for (const group of [...empty.chains, ...empty.combined]) {
    expect(group).toMatchObject({
      launchCount: 0,
      participantCount: 0,
      userCount: 7,
      launches: [],
      volumeTotal: { amount: '0', tradeCount: 0 },
    });
  }
});
