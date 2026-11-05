import { expect, it, vi } from 'vitest';

import simulateContractRead from '../../../src/services/stellar/simulateContractRead';

it('shares concurrent reads but does not retain stale settled results', async (): Promise<void> => {
  let complete: (value: never) => void = (): void => {};

  const server = {
    simulateTransaction: vi.fn(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    ),
  };

  const one = simulateContractRead(server as never, {} as never, 'state', true);
  const two = simulateContractRead(server as never, {} as never, 'state', true);

  expect(server.simulateTransaction).toHaveBeenCalledTimes(1);

  complete({ latestLedger: 10 } as never);

  await Promise.all([one, two]);

  server.simulateTransaction.mockResolvedValueOnce({ latestLedger: 11 });

  expect(await simulateContractRead(server as never, {} as never, 'state', true)).toMatchObject({
    latestLedger: 11,
  });

  expect(server.simulateTransaction).toHaveBeenCalledTimes(2);
});

it('evicts failed observations so retries perform a new request', async (): Promise<void> => {
  const server = {
    simulateTransaction: vi
      .fn()
      .mockRejectedValueOnce(new Error('Unavailable'))
      .mockResolvedValueOnce({ latestLedger: 12 }),
  };

  await expect(simulateContractRead(server as never, {} as never, 'state', true)).rejects.toThrow(
    'Unavailable',
  );

  await expect(
    simulateContractRead(server as never, {} as never, 'state', true),
  ).resolves.toMatchObject({ latestLedger: 12 });
});
