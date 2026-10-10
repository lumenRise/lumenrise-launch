import Launch from './store/Launch';
import TokenImage from './store/TokenImage';
import type { Configuration } from './types/configuration';

const markTokenImagesForCleanup = async (
  configuration: Configuration,
  now = new Date(),
): Promise<number> => {
  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60_000);

  const candidates = await TokenImage.find({
    network: configuration.network,
    status: 'pending',
    createdAt: { $lte: cutoff },
  })
    .sort({ createdAt: 1 })
    .limit(20)
    .lean();

  let marked = 0;

  for (const image of candidates) {
    const launch = await Launch.exists({
      network: configuration.network,
      owner: image.ownerAddress,
      'metadata.logo': image.publicUrl,
    });

    if (launch) {
      continue;
    }

    const result = await TokenImage.updateOne(
      { _id: image._id, status: 'pending' },
      {
        $set: {
          status: 'cleanup_ready',
          cleanupReadyAt: now,
          cleanupNextAt: new Date(now.getTime() + 24 * 60 * 60_000),
        },
      },
    );
    marked += result.modifiedCount;
  }

  return marked;
};

export default markTokenImagesForCleanup;
