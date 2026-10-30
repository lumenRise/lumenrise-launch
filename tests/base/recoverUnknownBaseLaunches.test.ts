import { beforeEach, expect, it, vi } from 'vitest';

import Launch from '../../src/models/Launch';
import createBaseLog from '../helpers/createBaseLog';
import type { BaseWriteContext } from '../../src/types/base/launch';
import createBaseCreationLog from '../helpers/createBaseCreationLog';
import processBaseBlock from '../../src/services/base/processBaseBlock';
import findBaseLaunchCreation from '../../src/services/base/findBaseLaunchCreation';
import recoverUnknownBaseLaunches from '../../src/services/base/recoverUnknownBaseLaunches';

vi.mock('../../src/models/Launch', () => ({ default: { exists: vi.fn() } }));
vi.mock('../../src/services/base/processBaseBlock', () => ({ default: vi.fn() }));
vi.mock('../../src/services/base/findBaseLaunchCreation', () => ({ default: vi.fn() }));

const trade = createBaseLog();

const context = {
  configuration: { network: 'testnet', factoryAddress: 'factory' },
  client: { getLogs: vi.fn() },
} as unknown as BaseWriteContext;

beforeEach((): void => {
  vi.resetAllMocks();

  vi.mocked(Launch.exists).mockResolvedValue(null);
  vi.mocked(context.client.getLogs).mockResolvedValue([]);
  vi.mocked(findBaseLaunchCreation).mockResolvedValue({
    asset: '0x4444444444444444444444444444444444444444',
    event: createBaseCreationLog(),
    number: 20n,
    hash: trade.blockHash!,
    timestamp: 100n,
  });
});

it('persists the verified launch before returning its trades and recovers an emitter only once', async (): Promise<void> => {
  const records = [
    { ...trade, blockNumber: 100n },
    { ...createBaseLog(3), blockNumber: 100n },
  ];
  const result = await recoverUnknownBaseLaunches(context, records);

  expect(result).toEqual(records);
  expect(findBaseLaunchCreation).toHaveBeenCalledOnce();
  expect(findBaseLaunchCreation).toHaveBeenCalledWith(context, trade.address, 100n);
  expect(processBaseBlock).toHaveBeenCalledWith(
    expect.objectContaining({ context, number: 20n, logs: [createBaseCreationLog()] }),
  );
  expect(vi.mocked(processBaseBlock).mock.calls[0]![0].advance).toBeUndefined();
});

it('filters foreign emitters and does not create a launch for them', async (): Promise<void> => {
  vi.mocked(findBaseLaunchCreation).mockResolvedValue(null);

  await expect(recoverUnknownBaseLaunches(context, [trade])).resolves.toEqual([]);
  expect(processBaseBlock).not.toHaveBeenCalled();
});

it('avoids creation lookups for already indexed launches', async (): Promise<void> => {
  vi.mocked(Launch.exists).mockResolvedValue({ _id: 'launch' } as never);

  await expect(recoverUnknownBaseLaunches(context, [trade])).resolves.toEqual([trade]);
  expect(findBaseLaunchCreation).not.toHaveBeenCalled();
});

it('retrieves same-block token transfers for a launch discovered after the address query', async (): Promise<void> => {
  const transfer = {
    ...createBaseLog(7),
    address: '0x4444444444444444444444444444444444444444' as const,
  };

  vi.mocked(context.client.getLogs).mockResolvedValue([transfer] as never);

  await expect(recoverUnknownBaseLaunches(context, [trade])).resolves.toEqual([trade, transfer]);
  expect(context.client.getLogs).toHaveBeenCalledWith(
    expect.objectContaining({
      address: transfer.address,
      fromBlock: trade.blockNumber,
      toBlock: trade.blockNumber,
    }),
  );
});
