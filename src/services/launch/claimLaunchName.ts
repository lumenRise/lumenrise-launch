import Launch from '../../models/Launch';
import LaunchName from '../../models/LaunchName';
import TokenImage from '../../models/TokenImage';
import type { LaunchData } from '../../types/launch/model';
import toLaunchSlug from '../../utils/launch/toLaunchSlug';

const claimLaunchName = async (launch: LaunchData): Promise<string> => {
  const existing = await Launch.findOne({
    chain: 'stellar' as const,
    network: launch.network,
    contractId: launch.contractId,
  })
    .select('slug')
    .lean();

  if (existing?.slug) {
    return existing.slug;
  }

  const slug = toLaunchSlug(launch.metadata.name);

  const image = await TokenImage.findOne({
    chain: 'stellar' as const,
    network: launch.network,
    publicUrl: launch.metadata.logo,
    ownerAddress: launch.owner,
  }).lean();

  if (image?.slug && (image.status === 'expired' || image.slug !== slug)) {
    const conflict = new Error(
      'On-chain project name does not match an active prelaunch reservation',
    );

    conflict.name = 'LaunchNameConflict';

    throw conflict;
  }

  try {
    await LaunchName.findOneAndUpdate(
      {
        chain: 'stellar' as const,
        network: launch.network,
        slug,
        ownerAddress: launch.owner,
        publicUrl: launch.metadata.logo,
        $or: [
          { status: 'reserved', contractId: null },
          { status: 'indexed', contractId: launch.contractId },
        ],
      },
      {
        $set: { contractId: launch.contractId, status: 'indexed' },
        $setOnInsert: {
          chain: 'stellar' as const,
          network: launch.network,
          slug,
          ownerAddress: launch.owner,
          publicUrl: launch.metadata.logo,
        },
      },
      { upsert: true },
    );
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      const conflict = new Error(`Project name ${slug} is already taken`, { cause: error });

      conflict.name = 'LaunchNameConflict';

      throw conflict;
    }

    throw error;
  }

  return slug;
};

export default claimLaunchName;
