import TokenImage from '../../models/TokenImage';

const markBaseImagesForCleanup = async (network: 'testnet' | 'public'): Promise<void> => {
  const now = new Date();

  await TokenImage.updateMany(
    {
      chain: 'base',
      network,
      status: 'pending',
      createdAt: { $lte: new Date(now.getTime() - 7 * 24 * 60 * 60_000) },
    },
    {
      $set: {
        status: 'cleanup_ready',
        cleanupReadyAt: now,
        cleanupNextAt: new Date(now.getTime() + 24 * 60 * 60_000),
      },
    },
  );
};

export default markBaseImagesForCleanup;
