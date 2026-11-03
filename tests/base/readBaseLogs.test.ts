import { expect, it, vi } from 'vitest';

import readBaseLogs from '../../src/services/base/readBaseLogs';
import type { BaseContext } from '../../src/types/base/configuration';

it('splits provider-limited ranges without changing the address filter', async (): Promise<void> => {
  const getLogs = vi
    .fn()
    .mockRejectedValueOnce(new Error('Response size limit'))
    .mockResolvedValueOnce([{ logIndex: 1 }])
    .mockResolvedValueOnce([{ logIndex: 2 }]);

  const context = { client: { getLogs } } as unknown as BaseContext;

  const request = {
    address: '0x1111111111111111111111111111111111111111' as const,
    fromBlock: 10n,
    toBlock: 13n,
  };

  expect(await readBaseLogs(context, request)).toEqual([{ logIndex: 1 }, { logIndex: 2 }]);

  expect(getLogs).toHaveBeenNthCalledWith(2, { ...request, toBlock: 11n });

  expect(getLogs).toHaveBeenNthCalledWith(3, { ...request, fromBlock: 12n });
});

it('does not multiply calls during a transport outage', async (): Promise<void> => {
  const getLogs = vi.fn().mockRejectedValue(new Error('Transport unavailable'));
  const context = { client: { getLogs } } as unknown as BaseContext;

  await expect(readBaseLogs(context, { fromBlock: 10n, toBlock: 20n })).rejects.toThrow(
    'Transport unavailable',
  );

  expect(getLogs).toHaveBeenCalledTimes(1);
});
