import log from '../../logger';
import Launch from '../../models/Launch';
import LaunchName from '../../models/LaunchName';
import TokenImage from '../../models/TokenImage';
import deleteTokenImageObject from './deleteTokenImageObject';

const processTokenImageCleanup = async (now = new Date()): Promise<void> => {
  const due = await TokenImage.find({
    status: { $in: ['cleanup_ready', 'deleting'] },
    cleanupNextAt: { $lte: now },
  })
    .sort({ cleanupNextAt: 1 })
    .limit(20)
    .lean();

  for (const image of due) {
    const claimed = await TokenImage.findOneAndUpdate(
      {
        _id: image._id,
        status: { $in: ['cleanup_ready', 'deleting'] },
        cleanupNextAt: { $lte: now },
      },
      { $set: { status: 'deleting', cleanupNextAt: new Date(now.getTime() + 15 * 60_000) } },
      { new: true },
    ).lean();

    if (!claimed) {
      continue;
    }

    try {
      const launch = await Launch.findOne({
        chain: claimed.chain ?? 'stellar',
        network: claimed.network,
        owner: claimed.ownerAddress,
        ...(claimed.chain === 'base'
          ? { prelaunchId: claimed._id.toString() }
          : { 'metadata.logo': claimed.publicUrl }),
      })
        .select('contractId asset')
        .lean();

      if (launch) {
        const finalized = await TokenImage.updateOne(
          { _id: claimed._id, status: 'deleting' },
          {
            $set: {
              status: 'finalized',
              launchContractId: launch.contractId,
              assetContractId: launch.asset,
              finalizedAt: now,
              cleanupReadyAt: null,
              cleanupNextAt: null,
            },
          },
        );

        if (finalized?.modifiedCount === 1) {
          log.info(
            {
              chain: claimed.chain ?? 'stellar',
              network: claimed.network,
              imageId: claimed._id,
              contractId: launch.contractId,
            },
            'Token image finalized',
          );
        }

        continue;
      }

      // Atomically release only an unclaimed reservation. A worker claim keeps the image alive.
      if (claimed.slug) {
        const released = await LaunchName.updateOne(
          {
            chain: claimed.chain ?? 'stellar',
            network: claimed.network,
            slug: claimed.slug,
            ownerAddress: claimed.ownerAddress,
            publicUrl: claimed.publicUrl,
            contractId: null,
            status: 'reserved',
          },
          { $set: { status: 'expired' } },
        );

        if (released.modifiedCount === 0) {
          const indexed = await LaunchName.exists({
            chain: claimed.chain ?? 'stellar',
            network: claimed.network,
            slug: claimed.slug,
            publicUrl: claimed.publicUrl,
            contractId: { $type: 'string' },
          });

          if (indexed) {
            continue;
          }
        }
      }

      await deleteTokenImageObject(claimed.objectKey);

      const expired = await TokenImage.updateOne(
        { _id: claimed._id, status: 'deleting' },
        {
          $set: { status: 'expired', expiredAt: now, cleanupNextAt: null },
        },
      );

      if (expired?.modifiedCount === 1) {
        log.info(
          { chain: claimed.chain ?? 'stellar', network: claimed.network, imageId: claimed._id },
          'Token image deleted',
        );
      }
    } catch (error) {
      log.warn({ error, imageId: claimed._id }, 'Token image cleanup will retry');

      const attempts = (claimed.cleanupAttempts ?? 0) + 1;
      const delay = Math.min(60 * 60_000, 60_000 * 2 ** Math.min(attempts, 6));

      await TokenImage.updateOne(
        { _id: claimed._id, status: 'deleting' },
        {
          $set: { cleanupAttempts: attempts, cleanupNextAt: new Date(now.getTime() + delay) },
        },
      );
    }
  }
};

export default processTokenImageCleanup;
