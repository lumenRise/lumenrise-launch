import { beforeEach, expect, it, vi } from 'vitest';

import Launch from '../src/models/Launch';
import LaunchTrade from '../src/models/LaunchTrade';
import getProjectVolume from '../src/services/stats/getProjectVolume';

vi.mock('../src/models/Launch', () => ({ default: { find: vi.fn() } }));

vi.mock('../src/models/LaunchTrade', () => ({ default: { find: vi.fn() } }));

const now = new Date('2026-10-29T12:00:00Z');
const close = vi.fn();

beforeEach((): void => {
  vi.resetAllMocks();

  vi.mocked(Launch.find).mockReturnValue({
    select: () => ({
      lean: async () => [
        { chain: 'stellar', contractId: 'stellar-curve' },
        { chain: 'base', contractId: 'base-curve', assetDecimals: 18, pairDecimals: 6 },
      ],
    }),
  } as never);
});

it('combines native decimals exactly, doubles amounts and keeps real counts and the 24h boundary', async (): Promise<void> => {
  const records = [
    {
      contractId: 'stellar-curve',
      grossAmount: '12345678',
      tradedAt: new Date('2026-10-28T12:00:00Z'),
      side: 'buy',
    },
    {
      chain: 'base',
      contractId: 'base-curve',
      grossAmount: '2000001',
      tradedAt: now,
      side: 'sell',
    },
    {
      chain: 'base',
      contractId: 'base-curve',
      grossAmount: '9007199254740993000000',
      tradedAt: new Date('2026-10-28T11:59:59Z'),
      side: 'buy',
    },
  ];

  const cursor = { [Symbol.asyncIterator]: () => records.values(), close };

  vi.mocked(LaunchTrade.find).mockReturnValue({
    select: () => ({ lean: () => ({ cursor: () => cursor }) }),
  } as never);

  const result = await getProjectVolume('public', now);

  expect(Launch.find).toHaveBeenCalledWith({ network: 'public' });

  expect(LaunchTrade.find).toHaveBeenCalledWith({ network: 'public', tradedAt: { $lte: now } });

  expect(result).toMatchObject({
    network: 'public',
    currency: 'USDC',
    multiplier: 2,
    volumeTotal: { amount: '18014398509481992.4691376', tradeCount: 3, buyCount: 2, sellCount: 1 },
    volume24h: { amount: '6.4691376', tradeCount: 2, buyCount: 1, sellCount: 1 },
  });

  expect(close).toHaveBeenCalledOnce();
});

it('returns zero volumes for an empty network', async (): Promise<void> => {
  const cursor = { [Symbol.asyncIterator]: () => [].values(), close };

  vi.mocked(LaunchTrade.find).mockReturnValue({
    select: () => ({ lean: () => ({ cursor: () => cursor }) }),
  } as never);

  const result = await getProjectVolume('testnet', now);

  expect(result.volumeTotal).toEqual({ amount: '0', tradeCount: 0, buyCount: 0, sellCount: 0 });

  expect(result.volume24h).toEqual(result.volumeTotal);
});

it.each([
  { chain: 'base', scale: 6, recentBuy: true },
  { chain: 'stellar', scale: 7, recentBuy: true },
  { chain: 'base', scale: 6, recentBuy: false },
  { chain: 'stellar', scale: 7, recentBuy: false },
] as const)(
  'counts a one-USDC buy and sell as four USDC on $chain with recentBuy=$recentBuy',
  async ({ chain, scale, recentBuy }): Promise<void> => {
    const records = [
      {
        chain,
        contractId: `${chain}-curve`,
        grossAmount: (10n ** BigInt(scale)).toString(),
        tradedAt: recentBuy ? now : new Date(now.getTime() - 25 * 3_600_000),
        side: 'buy',
      },
      {
        chain,
        contractId: `${chain}-curve`,
        grossAmount: (10n ** BigInt(scale)).toString(),
        tradedAt: now,
        side: 'sell',
      },
    ];

    const cursor = { [Symbol.asyncIterator]: () => records.values(), close };

    vi.mocked(LaunchTrade.find).mockReturnValue({
      select: () => ({ lean: () => ({ cursor: () => cursor }) }),
    } as never);

    const result = await getProjectVolume('testnet', now);

    expect(result.volumeTotal).toEqual({ amount: '4', tradeCount: 2, buyCount: 1, sellCount: 1 });

    expect(result.volume24h.amount).toBe(recentBuy ? '4' : '2');

    expect(result.volume24h.tradeCount).toBe(recentBuy ? 2 : 1);
  },
);

it('closes the cursor and fails instead of guessing decimals for an orphaned trade', async (): Promise<void> => {
  const records = [
    { chain: 'base', contractId: 'missing-curve', grossAmount: '100', tradedAt: now, side: 'buy' },
  ];

  const cursor = { [Symbol.asyncIterator]: () => records.values(), close };

  vi.mocked(LaunchTrade.find).mockReturnValue({
    select: () => ({ lean: () => ({ cursor: () => cursor }) }),
  } as never);

  await expect(getProjectVolume('testnet', now)).rejects.toThrow('denomination');

  expect(close).toHaveBeenCalledOnce();
});

it('combines all environments without mixing decimal scales for the same contract address', async (): Promise<void> => {
  vi.mocked(Launch.find).mockReturnValue({
    select: () => ({
      lean: async () => [
        {
          chain: 'base',
          network: 'testnet',
          contractId: 'same-address',
          assetDecimals: 18,
          pairDecimals: 6,
        },
        {
          chain: 'base',
          network: 'public',
          contractId: 'same-address',
          assetDecimals: 18,
          pairDecimals: 18,
        },
        { chain: 'stellar', network: 'public', contractId: 'stellar-curve' },
      ],
    }),
  } as never);

  const records = [
    {
      chain: 'base',
      network: 'testnet',
      contractId: 'same-address',
      grossAmount: '1000000',
      tradedAt: now,
      side: 'buy',
    },
    {
      chain: 'base',
      network: 'public',
      contractId: 'same-address',
      grossAmount: '1000000000000000000',
      tradedAt: now,
      side: 'sell',
    },
    {
      chain: 'stellar',
      network: 'public',
      contractId: 'stellar-curve',
      grossAmount: '10000000',
      tradedAt: now,
      side: 'buy',
    },
  ];

  const cursor = { [Symbol.asyncIterator]: () => records.values(), close };

  vi.mocked(LaunchTrade.find).mockReturnValue({
    select: () => ({ lean: () => ({ cursor: () => cursor }) }),
  } as never);

  const result = await getProjectVolume('all', now);

  expect(Launch.find).toHaveBeenCalledWith({});

  expect(LaunchTrade.find).toHaveBeenCalledWith({ tradedAt: { $lte: now } });

  expect(result.network).toBe('all');

  expect(result.volumeTotal.amount).toBe('6');

  expect(result.volume24h.amount).toBe('6');
});
