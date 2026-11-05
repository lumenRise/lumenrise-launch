import { Types } from 'mongoose';

import log from '../logger';
import StellarTransactionJob from '../models/StellarTransactionJob';
import processStellarTransaction from '../services/stellar/processStellarTransaction';

const processStellarTransactionJob = async (
  network: 'testnet' | 'public',
  jobId?: string,
): Promise<void> => {
  const now = new Date();

  const job = await StellarTransactionJob.findOneAndUpdate(
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
    const result = await processStellarTransaction(job.toObject());

    await StellarTransactionJob.updateOne(owner, {
      $set: {
        status: 'completed',
        result,
        observedBlock: Number(result.blockNumber),
        leaseUntil: null,
        lastError: null,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Stellar transaction processing failed';

    const conflict = error instanceof Error && error.name === 'LaunchNameConflict';

    const invalid =
      conflict || (error instanceof Error && error.name === 'InvalidStellarTransaction');

    await StellarTransactionJob.updateOne(owner, {
      $set: {
        status: invalid ? 'failed' : 'queued',
        failureStatus: conflict ? 409 : 400,
        scheduledAt: new Date(Date.now() + Math.min(60_000, 2000 * 2 ** Math.min(job.attempts, 5))),
        leaseUntil: null,
        lastError: message.slice(0, 2000),
      },
    });

    log.warn({ error, jobId: job._id }, 'Stellar transaction processing deferred');
  }
};

export default processStellarTransactionJob;
