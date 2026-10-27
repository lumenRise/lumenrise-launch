import type { Log } from 'viem';
import { decodeEventLog } from 'viem';

import Launch from '../../models/Launch';
import readBaseLaunch from './readBaseLaunch';
import LaunchName from '../../models/LaunchName';
import TokenImage from '../../models/TokenImage';
import factoryAbi from '../../constants/base/factoryAbi';
import toLaunchSlug from '../../utils/launch/toLaunchSlug';
import type { BaseEventContext } from '../../types/base/launch';

const indexBaseLaunch = async (
  context: BaseEventContext,
  log: Log,
  timestamp: bigint,
): Promise<void> => {
  if (
    log.address.toLowerCase() !== context.configuration.factoryAddress ||
    log.blockNumber === null ||
    log.removed
  ) {
    throw new Error('Invalid Base launch emitter');
  }

  const { args } = decodeEventLog({
    abi: factoryAbi,
    data: log.data,
    topics: log.topics,
    eventName: 'LaunchCreated',
    strict: true,
  });

  const registered = await context.client.readContract({
    address: context.configuration.factoryAddress,
    abi: factoryAbi,
    functionName: 'launch_at',
    args: [args.index],
    blockNumber: log.blockNumber,
  });

  if (registered.toLowerCase() !== args.launch.toLowerCase() || args.index < 1) {
    throw new Error('Base launch is not registered by the configured factory');
  }

  const read = await readBaseLaunch({
    context,
    address: args.launch,
    blockNumber: log.blockNumber,
  });

  const params = read.config.params;
  const owner = params.owner.toLowerCase();
  const slug = toLaunchSlug(params.metadata.name);

  const identity = {
    chain: 'base' as const,
    network: context.configuration.network,
    contractId: args.launch.toLowerCase(),
  };

  if (owner !== args.owner.toLowerCase()) {
    throw new Error('Base launch owner mismatch');
  }

  const reservation = await LaunchName.findOne({
    chain: 'base',
    network: identity.network,
    slug,
    ownerAddress: owner,
    status: { $in: ['reserved', 'indexed'] },
  })
    .session(context.session)
    .lean();

  const imageId = reservation?.prelaunchId ?? null;

  const image = imageId
    ? await TokenImage.findOne({
        _id: imageId,
        chain: 'base',
        network: identity.network,
        ownerAddress: owner,
        slug,
      })
        .session(context.session)
        .lean()
    : null;

  if (
    imageId &&
    (!image ||
      !['pending', 'cleanup_ready', 'finalized'].includes(image.status) ||
      image.publicUrl !== params.metadata.logo)
  ) {
    throw new Error('Base prelaunch reference does not match the launch owner and metadata');
  }

  await LaunchName.findOneAndUpdate(
    {
      chain: 'base',
      network: identity.network,
      slug,
      ownerAddress: owner,
      publicUrl: params.metadata.logo,
      $or: [
        { contractId: null, status: 'reserved' },
        { contractId: identity.contractId, status: 'indexed' },
      ],
    },
    { $set: { contractId: identity.contractId, status: 'indexed' } },
    { upsert: true, session: context.session },
  );

  const metadata = {
    name: params.metadata.name,
    symbol: params.metadata.symbol,
    logo: params.metadata.logo,
    description: image?.description ?? params.metadata.description,
    ...(image?.website ? { website: image.website } : {}),
    ...(image?.xAccount ? { xAccount: image.xAccount } : {}),
  };

  await Launch.updateOne(
    identity,
    {
      $setOnInsert: {
        ...identity,
        factoryContractId: context.configuration.factoryAddress,
        prelaunchId: imageId,
        factoryIndex: args.index,
        slug,
        owner,
        asset: params.asset.toLowerCase(),
        pair: params.pair.toLowerCase(),
        metadata,
        config: read.plainConfig,
        state: read.state,
        asOfLedger: Number(log.blockNumber),
        stateAsOfLedger: Number(log.blockNumber),
        observedAt: new Date(),
        stateObservedAt: new Date(),
        createdAt: new Date(Number(timestamp) * 1000),
        creationLedger: Number(log.blockNumber),
        creationTransactionHash: log.transactionHash,
        nextStatePollAt: null,
      },
    },
    { upsert: true, session: context.session },
  );

  if (image) {
    await TokenImage.updateOne(
      { _id: image._id },
      {
        $set: {
          status: 'finalized',
          launchContractId: identity.contractId,
          assetContractId: params.asset.toLowerCase(),
          finalizedAt: new Date(),
          cleanupReadyAt: null,
          cleanupNextAt: null,
        },
      },
      { session: context.session },
    );
  }
};

export default indexBaseLaunch;
