import log from './logger';
import Launch from './store/Launch';
import TokenImage from './store/TokenImage';
import type { Configuration } from './types/configuration';

const finalizeTokenImages = async (configuration: Configuration): Promise<void> => {
  const pending = await TokenImage.find({
    network: configuration.network,
    status: { $in: ['pending', 'cleanup_ready'] },
  }).lean();

  for (const image of pending) {
    const launch = await Launch.findOne({
      network: configuration.network,
      owner: image.ownerAddress,
      'metadata.logo': image.publicUrl,
    }).lean();

    if (!launch) {
      continue;
    }

    try {
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
