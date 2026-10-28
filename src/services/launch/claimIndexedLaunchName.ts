import { createHash } from 'node:crypto';

import LaunchName from '../../models/LaunchName';
import type { IndexedLaunchNameInput } from '../../types/launch/name';

const claimIndexedLaunchName = async (input: IndexedLaunchNameInput): Promise<string> => {
  const { chain, network, contractId, ownerAddress, publicUrl, slug: base, allowSuffix } = input;
  const digest = createHash('sha256')
    .update(`${chain}:${network}:${contractId}`)
    .digest('hex')
    .slice(0, 12);

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const suffix = attempt === 1 ? digest : `${digest}-${attempt}`;
    const slug = attempt === 0 ? base : `${base.slice(0, 99 - suffix.length)}-${suffix}`;

    if (input.session && allowSuffix) {
      const existing = await LaunchName.findOne({ chain, network, slug })
        .session(input.session)
        .lean();

      if (existing && existing.contractId !== contractId) {
        continue;
      }
    }

    try {
      await LaunchName.findOneAndUpdate(
        {
          chain,
          network,
          slug,
          ownerAddress,
          publicUrl,
          $or: [
            { status: 'reserved', contractId: null },
            { status: 'indexed', contractId },
          ],
        },
        {
          $set: { contractId, status: 'indexed' },
          $setOnInsert: { chain, network, slug, ownerAddress, publicUrl },
        },
        { upsert: true, ...(input.session ? { session: input.session } : {}) },
      );

      return slug;
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) {
        throw error;
      }

      if (input.session) {
        throw error;
      }

      if (!allowSuffix) {
        const conflict = new Error('Project name is already taken', { cause: error });

        conflict.name = 'LaunchNameConflict';

        throw conflict;
      }
    }
  }

  throw new Error('Unable to allocate a unique slug for the indexed launch');
};

export default claimIndexedLaunchName;
