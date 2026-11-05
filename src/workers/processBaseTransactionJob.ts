import { Types } from 'mongoose';

import log from '../logger';
import BaseTransactionJob from '../models/BaseTransactionJob';
import processBaseTransaction from '../services/base/processBaseTransaction';

const processBaseTransactionJob = async (
  network: 'testnet' | 'public',
  jobId?: string,
): Promise<void> => {
  const now = new Date();

  const job = await BaseTransactionJob.findOneAndUpdate(
    {
      network,
      ...(jobId ? { _id: new Types.ObjectId(jobId) } : {}),
      $or: [
        { status: 'queued', scheduledAt: { $lte: now } },
        { status: 'running', leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: { status: 'running', leaseUntil: new Date(Date.now() + 300_000) },
      $inc: { attempts: 1 },
    },
    { sort: { scheduledAt: 1 }, returnDocument: 'after' },
  );

  if (!job) {
    return;
  }

  const owner = { _id: job._id, status: 'running' as const, leaseUntil: job.leaseUntil };

  try {
    const result = await processBaseTransaction(job.toObject());

    await BaseTransactionJob.updateOne(owner, {
      $set: {
        status: 'completed',
        result,
        observedBlock: Number(result.blockNumber),
        leaseUntil: null,
        lastError: null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Base transaction processing failed';
    const invalid = error instanceof Error && error.name === 'InvalidBaseTransaction';

    await BaseTransactionJob.updateOne(owner, {
      $set: {
        status: invalid ? 'failed' : 'queued',
        scheduledAt: new Date(Date.now() + Math.min(60_000, 2000 * 2 ** Math.min(job.attempts, 5))),
        leaseUntil: null,
        lastError: message.slice(0, 2000),
      },
    });

    log.warn({ error, jobId: job._id }, 'Base transaction processing deferred');
  }
};

export default processBaseTransactionJob;
