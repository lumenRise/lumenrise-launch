import Launch from '../../models/Launch';
import TokenImage from '../../models/TokenImage';
import AssetIdentity from '../../models/AssetIdentity';

const getManagedTomlCurrencies = async (network: 'testnet' | 'public') => {
  const launches = await Launch.find({ chain: 'stellar', network })
    .sort({ factoryIndex: 1 })
    .select('contractId asset metadata')
    .lean();

  const identities = await AssetIdentity.find({
    network,
    assetContractId: { $in: launches.map((launch) => launch.asset) },
    status: 'verified',
  }).lean();

  const images = await TokenImage.find({
    chain: 'stellar',
    network,
    status: 'finalized',
    assetContractId: { $in: launches.map((launch) => launch.asset) },
  }).lean();

  const byContract = new Map(identities.map((identity) => [identity.assetContractId, identity]));
  const imageByContract = new Map(images.map((image) => [image.launchContractId, image.publicUrl]));
  const publishedAssets = new Set<string>();

  return launches.flatMap((launch) => {
    const identity = byContract.get(launch.asset);

    if (
      !identity?.assetCode ||
      !identity.issuer ||
      identity.assetCode !== launch.metadata.symbol ||
      publishedAssets.has(launch.asset)
    ) {
      return [];
    }

    publishedAssets.add(launch.asset);

    const logo = imageByContract.get(launch.contractId) ?? '';
    let image: string | undefined;

    try {
      const url = new URL(logo);

      if (
        url.protocol === 'https:' &&
        !url.username &&
        !url.password &&
        url.pathname.toLowerCase().endsWith('.png')
      ) {
        image = logo;
      }
    } catch {
      // A malformed image URL is omitted from the published metadata.
    }

    return [
      {
        code: identity.assetCode,
        issuer: identity.issuer,
        ...(launch.metadata.name.length <= 20 ? { name: launch.metadata.name } : {}),
        desc: launch.metadata.description,
        display_decimals: 7,
        is_asset_anchored: false,
        ...(image ? { image } : {}),
      },
    ];
  });
};

export default getManagedTomlCurrencies;
