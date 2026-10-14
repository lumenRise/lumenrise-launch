import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startPolledQueueWorker } from '../../../src/workers/polledQueue';

vi.mock('../../../src/logger', () => ({ default: { error: vi.fn() } }));

describe('durable launch holder queue and reconciliation', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('processes pending jobs without RabbitMQ and stops reconciliation on shutdown', async () => {
    const processJob = vi.fn().mockResolvedValue(undefined);
    const worker = await startPolledQueueWorker({
      broker: null,
      queue: 'holders',
      pollIntervalMs: 1000,
      processJob,
      parseJobId: () => 'job',
      label: 'Holders',
    });
    await vi.advanceTimersByTimeAsync(1000);
    expect(processJob).toHaveBeenCalledTimes(2);
    await worker.stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(processJob).toHaveBeenCalledTimes(2);
  });

  it('acknowledges a valid delivery only after processing and rejects malformed messages', async () => {
    let consume: (message: never) => Promise<void> = async () => {};
    const channel = {
      on: vi.fn(),
      assertQueue: vi.fn(),
      prefetch: vi.fn(),
      ack: vi.fn(),
      nack: vi.fn(),
      cancel: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      consume: vi.fn(async (_queue, callback) => {
        consume = callback;
        return { consumerTag: 'tag' };
      }),
    };
    const broker = { createConfirmChannel: vi.fn().mockResolvedValue(channel) };
    const processJob = vi.fn().mockResolvedValue(undefined);
    const parseJobId = vi.fn().mockReturnValue('job');
    const worker = await startPolledQueueWorker({
      broker: null,
      queue: 'holders',
      pollIntervalMs: 1000,
      processJob,
      parseJobId,
      label: 'Holders',
    });
    await worker.attachBroker(broker as never);
    const message = { content: Buffer.from('{}') } as never;
    await consume(message);
    expect(channel.assertQueue).toHaveBeenCalledWith('holders', { durable: true });
    expect(channel.prefetch).toHaveBeenCalledWith(1);
    expect(processJob).toHaveBeenCalledWith('job');
    expect(channel.ack).toHaveBeenCalledWith(message);
    expect(processJob.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      channel.ack.mock.invocationCallOrder[0]!,
    );
    parseJobId.mockReturnValue(null);
    await consume(message);
    expect(channel.nack).toHaveBeenCalledWith(message, false, false);
    await worker.stop();
  });

  it('does not start a waiting delivery after shutdown begins', async () => {
    let finish: () => void = () => {};
    let consume: (message: never) => Promise<void> = async () => {};
    const processJob = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const channel = {
      on: vi.fn(),
      assertQueue: vi.fn(),
      prefetch: vi.fn(),
      ack: vi.fn(),
      nack: vi.fn(),
      cancel: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      consume: vi.fn(async (_queue, callback) => {
        consume = callback;
        return { consumerTag: 'tag' };
      }),
    };
    const broker = { createConfirmChannel: vi.fn().mockResolvedValue(channel) };
    const worker = await startPolledQueueWorker({
      broker: null,
      queue: 'holders',
      pollIntervalMs: 1000,
      processJob,
      parseJobId: () => 'job',
      label: 'Holders',
    });
    await worker.attachBroker(broker as never);
    const delivery = consume({ content: Buffer.from('{}') } as never);
    const stop = worker.stop();
    finish();
    await Promise.all([delivery, stop]);
    expect(processJob).toHaveBeenCalledTimes(1);
  });
});
