import { beforeEach, expect, it, vi } from 'vitest';

import createBaseCreationLog from '../helpers/createBaseCreationLog';
import type { BaseContext } from '../../src/types/base/configuration';
import findBaseLaunchCreation from '../../src/services/base/findBaseLaunchCreation';

const event = createBaseCreationLog();

const context = {
  configuration: { factoryAddress: event.address, deploymentBlock: 1n },
  client: { readContract: vi.fn(), getCode: vi.fn(), getLogs: vi.fn(), getBlock: vi.fn() },
} as unknown as BaseContext;

beforeEach((): void => {
  vi.resetAllMocks();

  vi.mocked(context.client.readContract).mockResolvedValue({
    factory: event.address,
    params: { asset: '0x4444444444444444444444444444444444444444' },
  } as never);

  vi.mocked(context.client.getCode).mockImplementation(async (input): Promise<`0x${string}`> =>
    input!.blockNumber! >= 20n ? '0x1234' : '0x',
  );

  vi.mocked(context.client.getLogs).mockResolvedValue([
    { ...event, args: { curve: '0x1111111111111111111111111111111111111111' } },
  ] as never);

  vi.mocked(context.client.getBlock).mockResolvedValue({
    hash: event.blockHash,
    timestamp: 100n,
  } as never);
});

it('locates deployment with block-code search then requires an authentic factory event', async (): Promise<void> => {
  const result = await findBaseLaunchCreation(
    context,
    '0x1111111111111111111111111111111111111111',
    100n,
  );

  expect(result).toMatchObject({ number: 20n, hash: event.blockHash, timestamp: 100n });
  expect(context.client.getLogs).toHaveBeenCalledWith(
    expect.objectContaining({
      address: event.address,
      args: { curve: '0x1111111111111111111111111111111111111111' },
      fromBlock: 20n,
      toBlock: 20n,
    }),
  );
  expect(vi.mocked(context.client.getCode).mock.calls.length).toBeLessThan(9);
});

it('ignores emitters belonging to another factory without searching their history', async (): Promise<void> => {
  vi.mocked(context.client.readContract).mockResolvedValue({
    factory: '0x9999999999999999999999999999999999999999',
  } as never);

  await expect(
    findBaseLaunchCreation(context, '0x1111111111111111111111111111111111111111', 100n),
  ).resolves.toBeNull();
  expect(context.client.getCode).not.toHaveBeenCalled();
});

it('does not trust a forged get_config response without a factory creation event', async (): Promise<void> => {
  vi.mocked(context.client.getLogs).mockResolvedValue([]);

  await expect(
    findBaseLaunchCreation(context, '0x1111111111111111111111111111111111111111', 100n),
  ).resolves.toBeNull();
});

it('propagates RPC outages so the live cursor cannot skip an unresolved emitter', async (): Promise<void> => {
  vi.mocked(context.client.readContract).mockRejectedValue(new Error('RPC unavailable'));

  await expect(
    findBaseLaunchCreation(context, '0x1111111111111111111111111111111111111111', 100n),
  ).rejects.toThrow('RPC unavailable');
});
