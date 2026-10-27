import mongoose from 'mongoose';

import Launch from '../../models/Launch';
import BaseCursor from '../../models/BaseCursor';
import LaunchName from '../../models/LaunchName';
import TokenImage from '../../models/TokenImage';
import LaunchTrade from '../../models/LaunchTrade';
import refreshBaseMarket from './refreshBaseMarket';
import LaunchHolder from '../../models/LaunchHolder';
import BaseCheckpoint from '../../models/BaseCheckpoint';
import LaunchPriceSample from '../../models/LaunchPriceSample';
import type { BaseWriteContext } from '../../types/base/launch';

const reconcileBaseChain = async (context: BaseWriteContext): Promise<boolean> => {
  const { configuration, client, leaseOwner } = context;
  const key = { network: configuration.network, factoryAddress: configuration.factoryAddress };
  const finalized = await client.getBlock({ blockTag: 'finalized' });
  const cursor = await BaseCursor.findOne(key).lean();

  const checkpoints = await BaseCheckpoint.find({ ...key, finalized: false })
    .sort({ blockNumber: 1 })
    .lean();

  for (const checkpoint of checkpoints) {
    let block;

    try {
      block = await client.getBlock({ blockNumber: BigInt(checkpoint.blockNumber) });
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'BlockNotFoundError') {
        throw error;
      }
    }

    if (block?.hash === checkpoint.blockHash) {
      if (
        BigInt(checkpoint.blockNumber) <= finalized.number &&
        BigInt(checkpoint.blockNumber) < BigInt(cursor!.nextBlock)
      ) {
        await BaseCheckpoint.updateOne(
          { _id: checkpoint._id, blockHash: checkpoint.blockHash },
          { $set: { finalized: true } },
        );
      }

      continue;
    }

    const stable = await BaseCheckpoint.findOne({ ...key, finalized: true })
      .sort({ blockNumber: -1 })
      .lean();

    const boundary = stable ? BigInt(stable.blockNumber) : configuration.deploymentBlock - 1n;
    const stableBlock = boundary >= 0n ? await client.getBlock({ blockNumber: boundary }) : null;

    if (stable && stableBlock?.hash !== stable.blockHash) {
      throw new Error('Base finalized checkpoint changed; manual recovery is required');
    }

    await mongoose.connection.transaction(async (session): Promise<void> => {
      const locked = await BaseCursor.updateOne(
        { ...key, leaseOwner, leaseUntil: { $gt: new Date() } },
        { $set: { leaseUntil: new Date(Date.now() + 300_000) } },
        { session },
      );

      if (locked.matchedCount !== 1) {
        throw new Error('Base recovery lease expired');
      }

      const scope = { chain: 'base' as const, network: configuration.network };

      const orphaned = await Launch.find({ ...scope, creationLedger: { $gt: Number(boundary) } })
        .session(session)
        .lean();

      const contractIds = orphaned.map((launch): string => launch.contractId);

      await TokenImage.updateMany(
        { ...scope, launchContractId: { $in: contractIds }, status: 'finalized' },
        {
          $set: {
            status: 'pending',
            launchContractId: null,
            assetContractId: null,
            finalizedAt: null,
            cleanupReadyAt: null,
            cleanupNextAt: null,
          },
        },
        { session },
      );

      await LaunchName.updateMany(
        { ...scope, contractId: { $in: contractIds } },
        { $set: { status: 'reserved', contractId: null } },
        { session },
      );

      await Launch.deleteMany({ ...scope, contractId: { $in: contractIds } }, { session });

      await LaunchTrade.deleteMany({ ...scope, ledger: { $gt: Number(boundary) } }, { session });

      await LaunchPriceSample.deleteMany(
        { ...scope, ledger: { $gt: Number(boundary) } },
        { session },
      );

      await LaunchHolder.deleteMany({ ...scope, contractId: { $in: contractIds } }, { session });

      const survivors = await Launch.find(scope).session(session).lean();

      for (const launch of survivors) {
        if (!stableBlock) {
          throw new Error('Base launch predates its configured deployment block');
        }

        const holders = await LaunchHolder.distinct('address', {
          ...scope,
          contractId: launch.contractId,
        }).session(session);

        await refreshBaseMarket(
          { ...context, session },
          launch.contractId,
          boundary,
          stableBlock.timestamp,
          holders,
          true,
        );
      }

      await BaseCheckpoint.deleteMany(
        { ...key, blockNumber: { $gt: Number(boundary) } },
        { session },
      );

      await BaseCursor.updateOne(
        { ...key, leaseOwner },
        {
          $set: {
            nextBlock: (boundary + 1n).toString(),
            previousBlockHash: stableBlock?.hash ?? null,
            lastScannedAt: new Date(),
          },
        },
        { session },
      );
    });

    return true;
  }

  return false;
};

export default reconcileBaseChain;
