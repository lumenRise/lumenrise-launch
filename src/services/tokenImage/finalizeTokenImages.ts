import log from '../../logger';
import Launch from '../../models/Launch';
import TokenImage from '../../models/TokenImage';
import type { Configuration } from '../../types/configuration';

const finalizeTokenImages = async (configuration: Configuration): Promise<void> => {
  const pending = await TokenImage.find({
    chain: 'stellar' as const,
    network: configuration.network,
    status: { $in: ['pending', 'cleanup_ready'] },
  }).lean();

  for (const image of pending) {
    const launch = await Launch.findOne({
      chain: 'stellar' as const,
      network: configuration.network,
      owner: image.ownerAddress,
      'metadata.logo': image.publicUrl,
    }).lean();

    if (!launch) {
      continue;
    }

    try {
      const links: Record<string, string> = {};

      if (image.description) {
        links['metadata.description'] = image.description;
      }

      if (image.website) {
        links['metadata.website'] = image.website;
      }

      if (image.xAccount) {
        links['metadata.xAccount'] = image.xAccount;
      }

      if (Object.keys(links).length > 0) {
        await Launch.updateOne(
          {
            chain: 'stellar' as const,
            network: configuration.network,
            contractId: launch.contractId,
          },
          { $set: links },
        );
      }

      await TokenImage.updateOne(
        { _id: image._id, status: { $in: ['pending', 'cleanup_ready'] } },
        {
          $set: {
            status: 'finalized',
            launchContractId: launch.contractId,
            assetContractId: launch.asset,
            finalizedAt: new Date(),
            cleanupReadyAt: null,
            cleanupNextAt: null,
          },
        },
      );
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
        log.warn(
          { imageId: image._id, assetContractId: launch.asset },
          'Token already has a linked image',
        );

        continue;
      }

      throw error;
    }
  }
};

export default finalizeTokenImages;
