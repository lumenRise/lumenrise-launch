import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import log from '../../src/logger';
import Launch from '../../src/models/Launch';
import BaseCursor from '../../src/models/BaseCursor';
import createBaseLog from '../helpers/createBaseLog';
import getBaseContext from '../../src/services/base/getBaseContext';
import type { BaseWriteContext } from '../../src/types/base/launch';
import createBaseCreationLog from '../helpers/createBaseCreationLog';
import scanBaseNetwork from '../../src/services/base/scanBaseNetwork';
import commitBaseScanBlock from '../../src/services/base/commitBaseScanBlock';

vi.mock('../../src/logger', () => ({ default: { info: vi.fn() } }));

vi.mock('../../src/services/base/getBaseContext', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/commitBaseScanBlock', () => ({ default: vi.fn() }));

const trade = createBaseLog(2);
const factory = '0x3333333333333333333333333333333333333333';
const asset = '0x4444444444444444444444444444444444444444';

const creation = createBaseCreationLog();

const context = {
  leaseOwner: 'worker-one',
  configuration: {
    network: 'testnet',
    factoryAddress: factory,
    deploymentBlock: 20n,
    batchSize: 500n,
  },
  client: { getBlockNumber: vi.fn(), getBlock: vi.fn(), getLogs: vi.fn(), readContract: vi.fn() },
} as unknown as BaseWriteContext;

beforeEach((): void => {
  vi.resetAllMocks();

  vi.mocked(getBaseContext).mockResolvedValue(context);

  vi.mocked(commitBaseScanBlock).mockResolvedValue(true);

  vi.mocked(context.client.getBlockNumber).mockResolvedValue(20n);

  vi.mocked(context.client.getBlock).mockResolvedValue({
    number: 20n,
    hash: trade.blockHash,
    timestamp: 1_700_000_000n,
  } as never);

  vi.mocked(context.client.readContract).mockResolvedValue({ params: { asset } } as never);

  vi.spyOn(BaseCursor, 'findOne').mockReturnValue({
    lean: vi.fn().mockResolvedValue({ nextBlock: '20' }),
  } as never);

  vi.spyOn(Launch, 'find').mockReturnValue({
    select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
  } as never);
});

afterEach((): void => {
  vi.restoreAllMocks();
});

it('does not log empty block scans as activity', async (): Promise<void> => {
  vi.mocked(context.client.getLogs).mockResolvedValue([]);

  await scanBaseNetwork('testnet');

  expect(commitBaseScanBlock).toHaveBeenCalled();

  expect(log.info).not.toHaveBeenCalled();
});

it('discovers a launch before querying its first same-block trade and token transfers', async (): Promise<void> => {
  vi.mocked(context.client.getLogs)
    .mockResolvedValueOnce([creation] as never)
    .mockResolvedValueOnce([trade] as never);

  await scanBaseNetwork('testnet');

  expect(context.client.getLogs).toHaveBeenNthCalledWith(2, {
    address: [trade.address, asset],
    fromBlock: 20n,
    toBlock: 20n,
  });

  expect(commitBaseScanBlock).toHaveBeenCalledWith(
    context,
    expect.objectContaining({
      logs: [creation, trade],
      number: 20n,
      advance: true,
      mode: 'history',
      expectedNextBlock: '20',
    }),
  );
});

it('records progress through an empty log range', async (): Promise<void> => {
  vi.mocked(context.client.getLogs).mockResolvedValue([]);

  await scanBaseNetwork('testnet');

  expect(commitBaseScanBlock).toHaveBeenCalledWith(
    context,
    expect.objectContaining({ logs: [], number: 20n, advance: true }),
  );
});

it('does not take the writer lease or commit progress when log retrieval fails', async (): Promise<void> => {
  vi.mocked(context.client.getLogs).mockRejectedValue(new Error('RPC log limit'));

  await expect(scanBaseNetwork('testnet')).rejects.toThrow('RPC log limit');

  expect(commitBaseScanBlock).not.toHaveBeenCalled();
});

it('stops the batch when the block writer is busy', async (): Promise<void> => {
  vi.mocked(context.client.getLogs).mockResolvedValue([]);
  vi.mocked(commitBaseScanBlock).mockResolvedValue(false);

  await scanBaseNetwork('testnet');

  expect(commitBaseScanBlock).toHaveBeenCalledOnce();
});

it('discovers live trades without requiring their launch address in the database', async (): Promise<void> => {
  vi.mocked(BaseCursor.findOne).mockReturnValue({
    lean: async () => ({ nextBlock: '1', nextLiveBlock: '20', historyEndBlock: '19' }),
  } as never);

  vi.mocked(context.client.getLogs)
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([trade] as never);

  await scanBaseNetwork('testnet', 'live');

  expect(context.client.getLogs).toHaveBeenNthCalledWith(
    2,
    expect.objectContaining({ events: expect.any(Array), fromBlock: 20n, toBlock: 20n }),
  );
  expect(vi.mocked(context.client.getLogs).mock.calls[1]![0]).not.toHaveProperty('address');
  expect(commitBaseScanBlock).toHaveBeenCalledWith(
    context,
    expect.objectContaining({ mode: 'live', logs: [trade], expectedNextBlock: '20' }),
  );
});

it('bounds historical catch-up at the live starting boundary', async (): Promise<void> => {
  vi.mocked(BaseCursor.findOne).mockReturnValue({
    lean: async () => ({ nextBlock: '10', nextLiveBlock: '20', historyEndBlock: '19' }),
  } as never);

  vi.mocked(context.client.getLogs).mockResolvedValue([]);

  await scanBaseNetwork('testnet');

  expect(context.client.getLogs).toHaveBeenCalledWith(
    expect.objectContaining({ fromBlock: 10n, toBlock: 19n }),
  );
  expect(commitBaseScanBlock).toHaveBeenCalledWith(
    context,
    expect.objectContaining({ number: 19n, expectedNextBlock: '10' }),
  );
});
