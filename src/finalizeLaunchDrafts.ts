import { isDeepStrictEqual } from 'node:util';

import Launch from './store/Launch';
import LaunchDraft from './store/LaunchDraft';
import type { LaunchReader } from './types/launch';
import type { Configuration } from './types/configuration';

const finalizeLaunchDrafts = async (
  configuration: Configuration,
  reader: LaunchReader,
  now = new Date(),
): Promise<number> => {
  const drafts = await LaunchDraft.find({
    network: configuration.network,
    status: { $in: ['submitted', 'unmatched'] },
    assetContractId: { $type: 'string' },
    $or: [{ nextMatchAt: { $lte: now } }, { nextMatchAt: { $exists: false } }],
  })
    .sort({ nextMatchAt: 1, submittedAt: 1 })
    .limit(20)
    .lean();

  let confirmed = 0;

  for (const draft of drafts) {
    const attempts = (draft.matchAttempts ?? 0) + 1;
    const expired =
      !!draft.submittedAt &&
      now.getTime() - draft.submittedAt.getTime() > 24 * 60 * 60_000;
    const delay = Math.min(60 * 60_000, 60_000 * 2 ** Math.min(attempts, 6));
    let transactionVerified = !!draft.verifiedContractId;
    try {
      let contractId = draft.verifiedContractId;

      if (!contractId) {
        if (!draft.transactionHash) {
          continue;
        }

        const transaction = await reader.launchTransaction(
          draft.transactionHash,
        );

        if (transaction.status === 'FAILED') {
          await LaunchDraft.updateOne(
            { _id: draft._id, status: 'submitted' },
            { $set: { status: 'failed', nextMatchAt: null } },
          );

          continue;
        }

        if (transaction.status === 'PENDING') {
          await LaunchDraft.updateOne(
            { _id: draft._id, status: 'submitted' },
            {
              $set: {
                status: expired ? 'unmatched' : 'submitted',
                matchAttempts: attempts,
                nextMatchAt: expired ? null : new Date(now.getTime() + delay),
              },
            },
          );

          continue;
        }

        contractId = transaction.contractId;

        if (
          !contractId ||
          !isDeepStrictEqual(transaction.params, draft.params)
        ) {
          await LaunchDraft.updateOne(
            { _id: draft._id, status: 'submitted' },
            { $set: { status: 'unmatched', nextMatchAt: null } },
          );

          continue;
        }

        await LaunchDraft.updateOne(
          { _id: draft._id, verifiedContractId: null },
          { $set: { verifiedContractId: contractId } },
        );
        transactionVerified = true;
      }

      const launch = await Launch.findOne({
        network: draft.network,
        contractId,
      })
        .select('contractId owner asset config.params')
        .lean();

      if (!launch) {
        await LaunchDraft.updateOne(
          { _id: draft._id, status: { $in: ['submitted', 'unmatched'] } },
          { $set: { nextMatchAt: new Date(now.getTime() + 60_000) } },
        );

        continue;
      }

      if (
        launch.owner !== draft.ownerAddress ||
        launch.asset !== draft.assetContractId ||
        !isDeepStrictEqual(
          (launch.config as { params?: unknown }).params,
          draft.params,
        )
      ) {
        await LaunchDraft.updateOne(
          { _id: draft._id, status: { $in: ['submitted', 'unmatched'] } },
          { $set: { status: 'unmatched', nextMatchAt: null } },
        );

        continue;
      }

      const result = await LaunchDraft.updateOne(
        { _id: draft._id, status: { $in: ['submitted', 'unmatched'] } },
        {
          $set: {
            status: 'confirmed',
            launchContractId: contractId,
            confirmedAt: now,
            nextMatchAt: null,
          },
        },
      );

      confirmed += result.modifiedCount;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 11000
      ) {
        await LaunchDraft.updateOne(
          { _id: draft._id },
          { $set: { status: 'unmatched', nextMatchAt: null } },
        );

        continue;
      }

      await LaunchDraft.updateOne(
        { _id: draft._id, status: { $in: ['submitted', 'unmatched'] } },
        {
          $set: {
            status:
              expired && !transactionVerified ? 'unmatched' : draft.status,
            matchAttempts: attempts,
            nextMatchAt:
              expired && !transactionVerified
                ? null
                : new Date(now.getTime() + delay),
          },
        },
      );
    }
  }
  return confirmed;
};

export default finalizeLaunchDrafts;
