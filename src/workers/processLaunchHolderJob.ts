import log from '../logger';
import Launch from '../models/Launch';
import claimLaunchHolderJob from './claimLaunchHolderJob';
import type { HolderBalanceReader } from '../types/launch/holder';
import LaunchHolderRefreshJob from '../models/LaunchHolderRefreshJob';
import refreshLaunchHolder from '../services/launch/refreshLaunchHolder';

const processLaunchHolderJob = async (
  reader: HolderBalanceReader,
  jobId?: string,
): Promise<void> => {
  const job = await claimLaunchHolderJob(reader.network, jobId);

  if (!job) {
    return;
  }

  const owner = {
    _id: job._id,
    requestId: job.requestId,
    status: 'running' as const,
    leaseUntil: job.leaseUntil!,
  };

  try {
    const identity = {
      chain: 'stellar' as const,
      network: job.network,
      contractId: job.contractId,
    };

    const launch = await Launch.findOne(identity).lean();

    if (!launch || launch.asset !== job.asset) {
      throw new Error('Holder refresh launch or token is not indexed');
    }

    await refreshLaunchHolder(reader, identity, launch.asset, job.address);

    await LaunchHolderRefreshJob.updateOne(owner, {
      $set: { status: 'completed', leaseUntil: null, lastError: null },
    });
  } catch (error) {
    const retryDelay = Math.min(300000, 1000 * 2 ** Math.min(job.attempts, 8));

    await LaunchHolderRefreshJob.updateOne(owner, {
      $set: {
        status: 'queued',
        scheduledAt: new Date(Date.now() + retryDelay),
        leaseUntil: null,
        lastError: error instanceof Error ? error.message.slice(0, 2000) : 'Unknown error',
      },
    });

    log.warn(
      {
        err: error,
        chain: 'stellar',
        jobId: job._id,
        network: job.network,
        contractId: job.contractId,
        asset: job.asset,
        address: job.address,
        attempts: job.attempts,
        retryDelayMs: retryDelay,
      },
      'Stellar holder balance refresh failed; retry scheduled',
    );
  }
};

export default processLaunchHolderJob;
