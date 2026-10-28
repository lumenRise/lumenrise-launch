import { rpc, Account, contract } from '@stellar/stellar-sdk';

import Launch from '../../models/Launch';
import AssetIdentity from '../../models/AssetIdentity';
import resolveAssetIdentity from './resolveAssetIdentity';
import type { Configuration } from '../../types/configuration';
import checkHorizonAvailability from './checkHorizonAvailability';

const syncAssetIdentities = async (configuration: Configuration): Promise<number> => {
  const assets = await Launch.distinct('asset', {
    chain: 'stellar' as const,
    network: configuration.network,
  });

  const retryBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const unavailableRetryBefore = new Date(Date.now() - 15 * 60 * 1000);

  const existing = await AssetIdentity.find({
    network: configuration.network,
    assetContractId: { $in: assets },
  }).lean();

  const byContract = new Map(existing.map((item) => [item.assetContractId, item]));

  const pending = assets
    .filter((asset) => {
      const item = byContract.get(asset);

      return (
        !item ||
        (item.status === 'unavailable' && item.identityCheckedAt < unavailableRetryBefore) ||
        (item.status === 'unverified' && item.identityCheckedAt < retryBefore)
      );
    })
    .slice(0, 20);

  if (pending.length === 0) {
    return 0;
  }

  const server = new rpc.Server(configuration.rpcUrl, {
    allowHttp: configuration.rpcUrl.startsWith('http:'),
    timeout: 15_000,
  });

  await server.getNetwork();

  await checkHorizonAvailability(configuration.horizonUrl);

  const source = new Account(contract.NULL_ACCOUNT, '0');

  for (const asset of pending) {
    const identity = await resolveAssetIdentity(asset, server, source, configuration);

    await AssetIdentity.updateOne(
      { network: configuration.network, assetContractId: asset },
      { $set: identity },
      { upsert: true },
    );
  }

  return pending.length;
};

export default syncAssetIdentities;
