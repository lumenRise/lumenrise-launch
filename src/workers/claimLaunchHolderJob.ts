import { Types } from 'mongoose';

import LaunchHolderRefreshJob from '../models/LaunchHolderRefreshJob';

const claimLaunchHolderJob = async (
  network: 'testnet' | 'public',
  jobId?: string,
  now = new Date(),
) =>
  LaunchHolderRefreshJob.findOneAndUpdate(
    {
      chain: 'stellar' as const,
      network,
      ...(jobId ? { _id: new Types.ObjectId(jobId) } : {}),
      $or: [
        { status: 'queued', scheduledAt: { $lte: now } },
        { status: 'running', leaseUntil: { $lte: now } },
      ],
    },
    {
      $set: { status: 'running', leaseUntil: new Date(now.getTime() + 120000) },
      $inc: { attempts: 1 },
    },
    { sort: { scheduledAt: 1 }, runValidators: true, returnDocument: 'after' },
  );

export default claimLaunchHolderJob;
