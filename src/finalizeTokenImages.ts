import Launch from './store/Launch';
import TokenImage from './store/TokenImage';
import type { Configuration } from './types/configuration';

const finalizeTokenImages = async (
  configuration: Configuration,
): Promise<void> => {
  const pending = await TokenImage.find({
    network: configuration.network,
    status: 'pending',
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

    await TokenImage.updateOne(
      { _id: image._id, status: 'pending' },
      {
        $set: {
          status: 'finalized',
          launchContractId: launch.contractId,
          assetContractId: launch.asset,
          finalizedAt: new Date(),
        },
      },
    );
  }
};

export default finalizeTokenImages;
