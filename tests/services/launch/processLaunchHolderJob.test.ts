import { beforeEach, describe, expect, it, vi } from 'vitest';

import Launch from '../../../src/models/Launch';
import claimLaunchHolderJob from '../../../src/workers/claimLaunchHolderJob';
import LaunchHolderRefreshJob from '../../../src/models/LaunchHolderRefreshJob';
import processLaunchHolderJob from '../../../src/workers/processLaunchHolderJob';
import refreshLaunchHolder from '../../../src/services/launch/refreshLaunchHolder';

vi.mock('../../../src/logger', () => ({ default: { warn: vi.fn() } }));
vi.mock('../../../src/models/Launch', () => ({ default: { findOne: vi.fn() } }));
vi.mock('../../../src/models/LaunchHolderRefreshJob', () => ({ default: { updateOne: vi.fn() } }));
vi.mock('../../../src/workers/claimLaunchHolderJob', () => ({ default: vi.fn() }));
vi.mock('../../../src/services/launch/refreshLaunchHolder', () => ({ default: vi.fn() }));

const reader = { network: 'testnet' as const, tokenBalance: vi.fn() };
const job = {
  _id: 'job',
  requestId: 'request-before-new-trade',
  network: 'testnet',
  contractId: 'launch',
  asset: 'token',
  address: 'wallet',
  attempts: 1,
  leaseUntil: new Date('2026-10-14T00:00:00Z'),
};

describe('launch holder job processing', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(claimLaunchHolderJob).mockResolvedValue(job as never);
    vi.mocked(Launch.findOne).mockReturnValue({ lean: async () => ({ asset: 'token' }) } as never);
  });

  it('reads and stores the balance in launch, then completes only the claimed request', async () => {
    await processLaunchHolderJob(reader, 'job');
    expect(claimLaunchHolderJob).toHaveBeenCalledWith('testnet', 'job');
    expect(refreshLaunchHolder).toHaveBeenCalledWith(
      reader,
      { network: 'testnet', contractId: 'launch' },
      'token',
      'wallet',
    );
    expect(LaunchHolderRefreshJob.updateOne).toHaveBeenCalledWith(
      { _id: 'job', requestId: job.requestId, status: 'running', leaseUntil: job.leaseUntil },
      { $set: { status: 'completed', leaseUntil: null, lastError: null } },
    );
  });

  it('does nothing for duplicate deliveries after the job is complete', async () => {
    vi.mocked(claimLaunchHolderJob).mockResolvedValue(null);
    await processLaunchHolderJob(reader, 'job');
    expect(refreshLaunchHolder).not.toHaveBeenCalled();
  });

  it('defers RPC failures for reconciliation without overwriting a newer queued request', async () => {
    vi.mocked(refreshLaunchHolder).mockRejectedValue(new Error('RPC down'));
    await processLaunchHolderJob(reader, 'job');
    expect(LaunchHolderRefreshJob.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ requestId: job.requestId, leaseUntil: job.leaseUntil }),
      {
        $set: expect.objectContaining({
          status: 'queued',
          scheduledAt: expect.any(Date),
          lastError: 'RPC down',
        }),
      },
    );
  });

  it('checks the indexed token identity before requesting a balance', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({
      lean: async () => ({ asset: 'other-token' }),
    } as never);
    await processLaunchHolderJob(reader, 'job');
    expect(refreshLaunchHolder).not.toHaveBeenCalled();
    expect(LaunchHolderRefreshJob.updateOne).toHaveBeenCalledWith(expect.anything(), {
      $set: expect.objectContaining({ status: 'queued' }),
    });
  });
});
