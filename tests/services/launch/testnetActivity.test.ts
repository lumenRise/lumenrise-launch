import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import type { Chain } from '../../../src/types/network/chain';
import TestnetActivity from '../../../src/models/TestnetActivity';
import isNetworkActive from '../../../src/services/launch/isNetworkActive';
import handleLaunchRequest from '../../../src/services/messaging/handleLaunchRequest';
import networkActivityEvents from '../../../src/services/launch/networkActivityEvents';
import waitForNetworkActivity from '../../../src/services/launch/waitForNetworkActivity';

vi.mock('../../../src/logger', (): object => ({ default: { info: vi.fn(), warn: vi.fn() } }));

vi.mock('../../../src/models/TestnetActivity', (): object => ({ default: { findById: vi.fn() } }));

beforeEach((): void => {
  vi.clearAllMocks();

  vi.useFakeTimers();

  vi.setSystemTime(new Date('2026-11-08T10:00:00Z'));

  vi.mocked(TestnetActivity.findById).mockReturnValue({
    lean: vi.fn().mockResolvedValue(null),
  } as never);
});

afterEach((): void => {
  networkActivityEvents.removeAllListeners();

  vi.useRealTimers();
});

it.each(['base', 'stellar'] as const)(
  'never gates public %s processing on testnet activity',
  async (chain: Chain): Promise<void> => {
    expect(await isNetworkActive(chain, 'public')).toBe(true);

    expect(await waitForNetworkActivity(chain, 'public', new AbortController().signal)).toBe(true);

    expect(TestnetActivity.findById).not.toHaveBeenCalled();
  },
);

it.each(['base', 'stellar'] as const)(
  'treats missing or expired %s activity as asleep',
  async (chain: Chain): Promise<void> => {
    expect(await isNetworkActive(chain, 'testnet')).toBe(false);

    vi.mocked(TestnetActivity.findById).mockReturnValue({
      lean: vi.fn().mockResolvedValue({ network: 'testnet', activeUntil: new Date(Date.now()) }),
    } as never);

    expect(await isNetworkActive(chain, 'testnet')).toBe(false);

    vi.mocked(TestnetActivity.findById).mockReturnValue({
      lean: vi
        .fn()
        .mockResolvedValue({ network: 'testnet', activeUntil: new Date(Date.now() + 1) }),
    } as never);

    expect(await isNetworkActive(chain, 'testnet')).toBe(true);
  },
);

it('wakes the matching chain from durable activity when notified through RabbitMQ', async (): Promise<void> => {
  const controller = new AbortController();
  const waiting = waitForNetworkActivity('base', 'testnet', controller.signal);

  await vi.advanceTimersByTimeAsync(0);

  expect(networkActivityEvents.listenerCount('base')).toBe(1);

  vi.mocked(TestnetActivity.findById).mockReturnValue({
    lean: vi
      .fn()
      .mockResolvedValue({ network: 'testnet', activeUntil: new Date(Date.now() + 1000) }),
  } as never);

  await handleLaunchRequest({
    operation: 'testnet.activity',
    parameters: { chain: 'base', network: 'testnet' },
    deadline: Date.now() + 10000,
  });

  expect(await waiting).toBe(true);

  expect(networkActivityEvents.listenerCount('base')).toBe(0);

  expect(vi.getTimerCount()).toBe(0);
});

it('recovers a missed notification through database reconciliation and survives a lookup failure', async (): Promise<void> => {
  const controller = new AbortController();

  vi.mocked(TestnetActivity.findById).mockReturnValueOnce({
    lean: vi.fn().mockRejectedValue(new Error('Database unavailable')),
  } as never);

  const waiting = waitForNetworkActivity('stellar', 'testnet', controller.signal);

  await vi.advanceTimersByTimeAsync(0);

  vi.mocked(TestnetActivity.findById).mockReturnValue({
    lean: vi
      .fn()
      .mockResolvedValue({ network: 'testnet', activeUntil: new Date(Date.now() + 30000) }),
  } as never);

  await vi.advanceTimersByTimeAsync(5000);

  expect(await waiting).toBe(true);

  expect(vi.getTimerCount()).toBe(0);
});

it('does not extend activity from notifications or wake another chain', async (): Promise<void> => {
  const controller = new AbortController();
  const waiting = waitForNetworkActivity('stellar', 'testnet', controller.signal);

  await vi.advanceTimersByTimeAsync(0);

  await handleLaunchRequest({
    operation: 'testnet.activity',
    parameters: { chain: 'base', network: 'testnet' },
    deadline: Date.now() + 10000,
  });

  expect(TestnetActivity.findById).toHaveBeenCalledTimes(1);

  expect(networkActivityEvents.listenerCount('stellar')).toBe(1);

  controller.abort();

  expect(await waiting).toBe(false);

  expect(networkActivityEvents.listenerCount('stellar')).toBe(0);

  expect(vi.getTimerCount()).toBe(0);
});

it.each([
  { chain: 'base', network: 'public' },
  { chain: 'unknown', network: 'testnet' },
])(
  'rejects an invalid activity identity: %j',
  async (parameters: Record<string, string>): Promise<void> => {
    await expect(
      handleLaunchRequest({
        operation: 'testnet.activity',
        parameters,
        deadline: Date.now() + 10000,
      }),
    ).rejects.toThrow('Invalid testnet activity identity');
  },
);
