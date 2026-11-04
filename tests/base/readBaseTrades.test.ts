import { afterEach, expect, it, vi } from 'vitest';

import createBaseLog from '../helpers/createBaseLog';
import createBaseSwapLog from '../helpers/createBaseSwapLog';
import readBaseLaunch from '../../src/services/base/readBaseLaunch';
import readBaseTrades from '../../src/services/base/readBaseTrades';
import type { BaseContext } from '../../src/types/base/configuration';
import { pool, asset, pair, curve, trader } from '../helpers/basePoolFixture';
import type { LaunchData as LaunchRecord } from '../../src/types/launch/model';

vi.mock('../../src/services/base/readBaseLaunch', () => ({ default: vi.fn() }));

const readContract = vi.fn();
const getLogs = vi.fn();
const getTransactionReceipt = vi.fn();

const context = {
  configuration: { network: 'testnet' },
  client: { readContract, getLogs, getTransactionReceipt },
} as unknown as BaseContext;

const launch = {
  contractId: curve,
  asset,
  pair,
  assetDecimals: 18,
  pairDecimals: 6,
} as LaunchRecord;

afterEach((): void => {
  vi.resetAllMocks();
});

it('keeps historical curve trades even when the stored launch is graduated', async (): Promise<void> => {
  readContract.mockResolvedValue({ graduated: false });

  expect(
    await readBaseTrades(
      context,
      { ...launch, state: { graduated: true } },
      [createBaseLog()],
      100n,
    ),
  ).toHaveLength(1);

  expect(readContract).not.toHaveBeenCalled();
});

it('keeps the final curve buy and excludes events after the recorded graduation boundary without RPC', async (): Promise<void> => {
  const event = createBaseLog();
  const graduated = { ...launch, graduationBlock: 20, graduationLogIndex: event.logIndex };

  expect(await readBaseTrades(context, graduated, [event], 100n)).toHaveLength(1);

  expect(
    await readBaseTrades(context, graduated, [{ ...event, logIndex: event.logIndex! + 1 }], 100n),
  ).toEqual([]);

  expect(await readBaseTrades(context, graduated, [{ ...event, blockNumber: 21n }], 100n)).toEqual(
    [],
  );

  expect(readContract).not.toHaveBeenCalled();

  expect(getLogs).not.toHaveBeenCalled();
});

it('records matching pool swaps once per log and attributes the transaction sender instead of the router', async (): Promise<void> => {
  const swap = createBaseSwapLog();

  vi.mocked(readBaseLaunch).mockResolvedValue({ pool } as never);

  getTransactionReceipt.mockResolvedValue({
    status: 'success',
    blockHash: swap.blockHash,
    transactionHash: swap.transactionHash,
    from: trader,
  });

  const trades = await readBaseTrades(
    context,
    launch,
    [
      swap,
      { ...swap, logIndex: 5 },
      { ...swap, topics: [swap.topics[0]!, `0x${'c'.repeat(64)}`, swap.topics[2]!] },
    ],
    100n,
  );

  expect(trades).toHaveLength(2);

  expect(trades[0]).toMatchObject({ trader, contractId: curve, side: 'buy' });

  expect(getTransactionReceipt).toHaveBeenCalledTimes(1);

  getTransactionReceipt.mockResolvedValue({
    status: 'success',
    blockHash: 'changed',
    transactionHash: swap.transactionHash,
    from: trader,
  });

  await expect(readBaseTrades(context, launch, [swap], 100n)).rejects.toThrow('canonical');
});

it('ignores pool events before the launch has graduated', async (): Promise<void> => {
  vi.mocked(readBaseLaunch).mockResolvedValue({ pool: null } as never);

  expect(await readBaseTrades(context, launch, [createBaseSwapLog()], 100n)).toEqual([]);

  expect(getTransactionReceipt).not.toHaveBeenCalled();
});
