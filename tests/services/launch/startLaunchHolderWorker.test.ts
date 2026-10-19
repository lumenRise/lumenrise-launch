import amqp from 'amqplib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startPolledQueueWorker } from '../../../src/workers/polledQueue';
import startLaunchHolderWorker from '../../../src/services/launch/startLaunchHolderWorker';

vi.mock('amqplib', () => ({ default: { connect: vi.fn() } }));
vi.mock('../../../src/logger', () => ({ default: { warn: vi.fn() } }));
vi.mock('../../../src/workers/polledQueue', () => ({ startPolledQueueWorker: vi.fn() }));
vi.mock('../../../src/workers/processLaunchHolderJob', () => ({ default: vi.fn() }));

const baseWorker = { attachBroker: vi.fn(), stop: vi.fn() };
const broker = { on: vi.fn(), close: vi.fn() };
const reader = { network: 'testnet' as const, tokenBalance: vi.fn() };

describe('launch connection to the shared broker', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.mocked(startPolledQueueWorker).mockResolvedValue(baseWorker);
    vi.mocked(amqp.connect).mockResolvedValue(broker as never);
    broker.close.mockResolvedValue(undefined);
  });
  afterEach(() => vi.useRealTimers());

  it('reconnects after broker failure while the database reconciliation worker stays active', async () => {
    vi.mocked(amqp.connect).mockRejectedValueOnce(new Error('broker down'));
    const worker = await startLaunchHolderWorker(reader, {
      rabbitmqUrl: 'amqp://shared-broker',
      network: 'testnet',
      pollIntervalMs: 1000,
    } as never);
    await vi.advanceTimersByTimeAsync(5000);
    expect(amqp.connect).toHaveBeenCalledTimes(2);
    expect(amqp.connect).toHaveBeenCalledWith('amqp://shared-broker', { timeout: 5000 });
    expect(startPolledQueueWorker).toHaveBeenCalledOnce();
    expect(startPolledQueueWorker).toHaveBeenCalledWith(
      expect.objectContaining({ queue: 'lumenrise.launch.holder-refresh.v2.testnet', broker: null }),
    );
    expect(baseWorker.attachBroker).toHaveBeenCalledWith(broker);
    await worker.stop();
    expect(baseWorker.stop).toHaveBeenCalledOnce();
    expect(broker.close).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10000);
    expect(amqp.connect).toHaveBeenCalledTimes(2);
  });
});
