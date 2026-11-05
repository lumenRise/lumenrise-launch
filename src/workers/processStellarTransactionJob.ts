import { Types } from 'mongoose';

import log from '../logger';
import StellarTransactionJob from '../models/StellarTransactionJob';
import processStellarTransaction from '../services/stellar/processStellarTransaction';

const maxAttempts = 20;
const maxNotFoundAttempts = 6;

const processStellarTransactionJob = async (
  network: 'testnet' | 'public',
  jobId?: string,
): Promise<void> => {
  const now = new Date();
  const identity = { network, ...(jobId ? { _id: new Types.ObjectId(jobId) } : {}) };

  await StellarTransactionJob.updateMany(
    {
      ...identity,
      $and: [
        {
          $or: [
            { attempts: { $gte: maxAttempts } },
            { notFoundAttempts: { $gte: maxNotFoundAttempts } },
          ],
        },
        {
          $or: [
            { status: 'queued', scheduledAt: { $lte: now } },
            { status: 'running', leaseUntil: { $lte: now } },
          ],
        },
      ],
    },
    { $set: { status: 'failed', failureStatus: 400, leaseUntil: null } },
  );

  const job = await StellarTransactionJob.findOneAndUpdate(
    {
      ...identity,
      attempts: { $lt: maxAttempts },
      notFoundAttempts: { $not: { $gte: maxNotFoundAttempts } },
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

    const notFound = error instanceof Error && error.name === 'StellarTransactionNotFound';
    const notFoundAttempts = (job.notFoundAttempts ?? 0) + (notFound ? 1 : 0);
    const retryAttempt = notFound ? notFoundAttempts : job.attempts;

    const failed =
      invalid || job.attempts >= maxAttempts || notFoundAttempts >= maxNotFoundAttempts;

    await StellarTransactionJob.updateOne(owner, {
      $set: {
        status: failed ? 'failed' : 'queued',
        notFoundAttempts,
        failureStatus: conflict ? 409 : 400,
        scheduledAt: new Date(Date.now() + Math.min(60_000, 2000 * 2 ** Math.min(retryAttempt, 5))),
        leaseUntil: null,
        lastError: message.slice(0, 2000),
      },
    });

    log.warn(
      { err: error, jobId: job._id, attempts: job.attempts, notFoundAttempts },
      failed ? 'Stellar transaction processing failed' : 'Stellar transaction processing deferred',
    );
  }
};

export default processStellarTransactionJob;
