import { afterEach, expect, it, vi } from 'vitest';

import readBaseBlock from '../../src/services/base/readBaseBlock';
import getBaseRuntime from '../../src/services/base/getBaseRuntime';
import type { BaseContext } from '../../src/types/base/configuration';
import readBaseFinalized from '../../src/services/base/readBaseFinalized';

const getBlock = vi.fn();

const context = {
  configuration: { network: 'public', rpcUrl: 'https://shared.example' },
  client: { getBlock },
} as unknown as BaseContext;

afterEach((): void => {
  vi.useRealTimers();
});

it('shares concurrent headers within a batch and discards them for the next batch', async (): Promise<void> => {
  getBlock.mockResolvedValue({ number: 20n, hash: 'first' });

  getBaseRuntime('public').blocks.clear();

  await Promise.all([readBaseBlock(context, 20n), readBaseBlock(context, 20n)]);

  expect(getBlock).toHaveBeenCalledTimes(1);

  getBaseRuntime('public').blocks.clear();

  getBlock.mockResolvedValue({ number: 20n, hash: 'replacement' });

  expect((await readBaseBlock(context, 20n)).hash).toBe('replacement');

  expect(getBlock).toHaveBeenCalledTimes(2);
});

it('shares finalized observations for 60 seconds and refreshes after expiry', async (): Promise<void> => {
  vi.useFakeTimers();

  getBlock.mockClear().mockResolvedValue({ number: 10n });

  await Promise.all([readBaseFinalized(context), readBaseFinalized(context)]);

  expect(getBlock).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(59_000);

  await readBaseFinalized(context);

  expect(getBlock).toHaveBeenCalledTimes(1);

  await vi.advanceTimersByTimeAsync(1001);

  await readBaseFinalized(context);

  expect(getBlock).toHaveBeenCalledTimes(2);
});

it('does not retain failed finalized observations', async (): Promise<void> => {
  const failing = {
    ...context,
    configuration: { ...context.configuration, rpcUrl: 'https://failing.example' },
  };

  getBlock.mockRejectedValueOnce(new Error('Unavailable'));

  await expect(readBaseFinalized(failing)).rejects.toThrow('Unavailable');

  getBlock.mockResolvedValue({ number: 11n });

  expect((await readBaseFinalized(failing)).number).toBe(11n);
});
