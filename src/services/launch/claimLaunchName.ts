import Launch from '../../models/Launch';
import TokenImage from '../../models/TokenImage';
import type { LaunchData } from '../../types/launch/model';
import toLaunchSlug from '../../utils/launch/toLaunchSlug';
import claimIndexedLaunchName from './claimIndexedLaunchName';

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

  return claimIndexedLaunchName({
    chain: 'stellar',
    network: launch.network,
    contractId: launch.contractId,
    ownerAddress: launch.owner,
    publicUrl: launch.metadata.logo,
    slug,
    allowSuffix: !image,
  });
};

export default claimLaunchName;
