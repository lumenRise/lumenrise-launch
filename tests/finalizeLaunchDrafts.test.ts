import { beforeEach, describe, expect, it, vi } from 'vitest';

import Launch from '../src/store/Launch';
import LaunchDraft from '../src/store/LaunchDraft';
import type { LaunchReader } from '../src/types/launch';
import finalizeLaunchDrafts from '../src/finalizeLaunchDrafts';
import type { Configuration } from '../src/types/configuration';

vi.mock('../src/store/Launch', () => ({ default: { findOne: vi.fn() } }));
vi.mock('../src/store/LaunchDraft', () => ({ default: { find: vi.fn(), updateOne: vi.fn() } }));

const now = new Date('2026-10-10T00:00:00.000Z');
const params = { owner: 'GWALLET', asset: 'CASSET', metadata: { name: 'Launch' } };
const draft = {
  _id: 'draft1', network: 'testnet', ownerAddress: 'GWALLET', assetContractId: 'CASSET',
  transactionHash: 'a'.repeat(64), verifiedContractId: null, params, status: 'submitted',
};
const configuration = { network: 'testnet' } as Configuration;

const reader = (transaction: { status: 'SUCCESS' | 'FAILED' | 'PENDING'; contractId: string | null; params: unknown }) => ({
  launchTransaction: vi.fn().mockResolvedValue(transaction),
} as unknown as LaunchReader);

describe('launch draft finalization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(LaunchDraft.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([draft]) }) }),
    } as never);
    vi.mocked(LaunchDraft.updateOne).mockResolvedValue({ modifiedCount: 1 } as never);
  });

  it('confirms only the contract returned by a successful transaction and matching indexed params', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ contractId: 'CLAUNCH', owner: 'GWALLET', asset: 'CASSET', config: { params } }) }),
    } as never);
    const txReader = reader({ status: 'SUCCESS', contractId: 'CLAUNCH', params });
    expect(await finalizeLaunchDrafts(configuration, txReader, now)).toBe(1);
    expect(txReader.launchTransaction).toHaveBeenCalledTimes(1);
    expect(LaunchDraft.updateOne).toHaveBeenCalledWith(
      { _id: 'draft1', status: { $in: ['submitted', 'unmatched'] } },
      { $set: expect.objectContaining({ status: 'confirmed', launchContractId: 'CLAUNCH' }) },
    );
  });

  it('does not create a confirmed launch from a failed transaction', async () => {
    expect(await finalizeLaunchDrafts(configuration, reader({ status: 'FAILED', contractId: null, params: null }), now)).toBe(0);
    expect(Launch.findOne).not.toHaveBeenCalled();
    expect(LaunchDraft.updateOne).toHaveBeenCalledWith(
      { _id: 'draft1', status: 'submitted' },
      { $set: { status: 'failed', nextMatchAt: null } },
    );
  });

  it('backs off a pending transaction without looking for a launch', async () => {
    expect(await finalizeLaunchDrafts(configuration, reader({ status: 'PENDING', contractId: null, params: null }), now)).toBe(0);
    expect(Launch.findOne).not.toHaveBeenCalled();
    expect(LaunchDraft.updateOne).toHaveBeenCalledWith(
      { _id: 'draft1', status: 'submitted' },
      { $set: { status: 'submitted', matchAttempts: 1, nextMatchAt: new Date('2026-10-10T00:02:00.000Z') } },
    );
  });

  it('uses the saved verified contract without another RPC call', async () => {
    vi.mocked(LaunchDraft.find).mockReturnValue({
      sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([{ ...draft, verifiedContractId: 'CLAUNCH' }]) }) }),
    } as never);
    vi.mocked(Launch.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ contractId: 'CLAUNCH', owner: 'GWALLET', asset: 'CASSET', config: { params } }) }),
    } as never);
    const txReader = reader({ status: 'PENDING', contractId: null, params: null });
    expect(await finalizeLaunchDrafts(configuration, txReader, now)).toBe(1);
    expect(txReader.launchTransaction).not.toHaveBeenCalled();
  });

  it('keeps an unmatched claim private', async () => {
    vi.mocked(Launch.findOne).mockReturnValue({
      select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ contractId: 'CLAUNCH', owner: 'GWALLET', asset: 'CASSET', config: { params: { ...params, metadata: { name: 'Other' } } } }) }),
    } as never);
    expect(await finalizeLaunchDrafts(configuration, reader({ status: 'SUCCESS', contractId: 'CLAUNCH', params }), now)).toBe(0);
    expect(LaunchDraft.updateOne).toHaveBeenCalledWith(
      { _id: 'draft1', status: { $in: ['submitted', 'unmatched'] } },
      { $set: { status: 'unmatched', nextMatchAt: null } },
    );
  });
});
