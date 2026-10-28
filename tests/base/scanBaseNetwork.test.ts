import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import Launch from '../../src/models/Launch';
import BaseCursor from '../../src/models/BaseCursor';
import createBaseLog from '../helpers/createBaseLog';
import getBaseContext from '../../src/services/base/getBaseContext';
import type { BaseWriteContext } from '../../src/types/base/launch';
import createBaseCreationLog from '../helpers/createBaseCreationLog';
import scanBaseNetwork from '../../src/services/base/scanBaseNetwork';
import acquireBaseLease from '../../src/services/base/acquireBaseLease';
import releaseBaseLease from '../../src/services/base/releaseBaseLease';
import processBaseBlock from '../../src/services/base/processBaseBlock';

vi.mock('../../src/services/base/getBaseContext', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/acquireBaseLease', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/releaseBaseLease', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/processBaseBlock', () => ({ default: vi.fn() }));

vi.mock('../../src/services/base/reconcileBaseChain', () => ({ default: vi.fn() }));

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

  vi.mocked(acquireBaseLease).mockResolvedValue(context);

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

  expect(processBaseBlock).toHaveBeenCalledWith(
    expect.objectContaining({ context, logs: [creation, trade], number: 20n, advance: true }),
  );

  expect(releaseBaseLease).toHaveBeenCalledWith(context);
});

it('records progress through an empty log range', async (): Promise<void> => {
  vi.mocked(context.client.getLogs).mockResolvedValue([]);

  await scanBaseNetwork('testnet');

  expect(processBaseBlock).toHaveBeenCalledWith(
    expect.objectContaining({ logs: [], number: 20n, advance: true }),
  );
});

it('retains progress on RPC failure and releases the lease for a later retry', async (): Promise<void> => {
  vi.mocked(context.client.getLogs).mockRejectedValue(new Error('RPC log limit'));

  await expect(scanBaseNetwork('testnet')).rejects.toThrow('RPC log limit');

  expect(processBaseBlock).not.toHaveBeenCalled();

  expect(releaseBaseLease).toHaveBeenCalledWith(context);
});

it('does not run a second scanner while another writer owns the lease', async (): Promise<void> => {
  vi.mocked(acquireBaseLease).mockResolvedValue(null);

  await scanBaseNetwork('testnet');

  expect(context.client.getLogs).not.toHaveBeenCalled();
});
