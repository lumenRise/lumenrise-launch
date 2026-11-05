import mongoose from 'mongoose';

import log from '../../logger';
import Launch from '../../models/Launch';
import BaseCursor from '../../models/BaseCursor';
import LaunchName from '../../models/LaunchName';
import TokenImage from '../../models/TokenImage';
import LaunchTrade from '../../models/LaunchTrade';
import refreshBaseMarket from './refreshBaseMarket';
import readBaseFinalized from './readBaseFinalized';
import LaunchHolder from '../../models/LaunchHolder';
import BaseCheckpoint from '../../models/BaseCheckpoint';
import LaunchPriceSample from '../../models/LaunchPriceSample';
import refreshRecordedHoldings from './refreshRecordedHoldings';
import type { BaseWriteContext } from '../../types/base/launch';
import BaseTransactionJob from '../../models/BaseTransactionJob';

const reconcileBaseChain = async (context: BaseWriteContext): Promise<boolean> => {
  const { configuration, client, leaseOwner } = context;
  const key = { network: configuration.network, factoryAddress: configuration.factoryAddress };
  const finalized = await readBaseFinalized(context);

  if (finalized.number === null) {
    throw new Error('Finalized block has no number');
  }

  const cursor = await BaseCursor.findOne(key).lean();

  const checkpoints = await BaseCheckpoint.find({ ...key, finalized: false })
    .sort({ blockNumber: -1 })
    .limit(1)
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
      // A canonical descendant fixes its complete ancestry. Finalize its stable prefix
      // without repeating an RPC request for every checkpoint on each live block.
      const boundary =
        BigInt(checkpoint.blockNumber) < finalized.number
          ? BigInt(checkpoint.blockNumber)
          : finalized.number;

      await BaseCheckpoint.updateMany(
        { ...key, finalized: false, blockNumber: { $lte: Number(boundary) } },
        { $set: { finalized: true } },
      );

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
      const factoryScope = { ...scope, factoryContractId: configuration.factoryAddress };
      const ownedContracts = await Launch.distinct('contractId', factoryScope).session(session);
      const marketScope = { ...scope, contractId: { $in: ownedContracts } };

      const orphaned = await Launch.find({
        ...factoryScope,
        creationLedger: { $gt: Number(boundary) },
      })
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

      await LaunchHolder.deleteMany({ ...scope, contractId: { $in: contractIds } }, { session });

      await LaunchTrade.deleteMany(
        { ...marketScope, ledger: { $gt: Number(boundary) } },
        { session },
      );

      await LaunchPriceSample.deleteMany(
        { ...marketScope, ledger: { $gt: Number(boundary) } },
        { session },
      );

      const survivors = await Launch.find(factoryScope).session(session).lean();

      for (const launch of survivors) {
        if (!stableBlock) {
          throw new Error('Base launch predates its configured deployment block');
        }

        await refreshBaseMarket(
          { ...context, session },
          launch.contractId,
          boundary,
          stableBlock.timestamp,
          [],
          true,
        );

        await Launch.updateOne(
          { ...factoryScope, contractId: launch.contractId },
          { $set: { poolNextBlock: null } },
          { session },
        );

        await refreshRecordedHoldings({ ...context, session }, launch.contractId);
      }

      await BaseTransactionJob.updateMany(
        {
          network: configuration.network,
          status: 'completed',
          observedBlock: { $gt: Number(boundary) },
        },
        { $set: { status: 'queued', result: null, scheduledAt: new Date(), leaseUntil: null } },
        { session },
      );

      await BaseCheckpoint.deleteMany(
        { ...key, blockNumber: { $gt: Number(boundary) } },
        { session },
      );

      await BaseCursor.updateOne(
        { ...key, leaseOwner },
        {
          $set: {
            nextBlock: (BigInt(cursor!.nextBlock) < boundary + 1n
              ? BigInt(cursor!.nextBlock)
              : boundary + 1n
            ).toString(),
            nextLiveBlock: (cursor?.nextLiveBlock != null &&
            BigInt(cursor.nextLiveBlock) < boundary + 1n
              ? BigInt(cursor.nextLiveBlock)
              : boundary + 1n
            ).toString(),
            previousBlockHash:
              BigInt(cursor!.nextBlock) < boundary + 1n
                ? cursor!.previousBlockHash
                : (stableBlock?.hash ?? null),
            lastScannedAt: new Date(),
          },
        },
        { session },
      );
    });

    log.warn(
      {
        chain: 'base',
        network: configuration.network,
        factoryContractId: configuration.factoryAddress,
        boundary: boundary.toString(),
      },
      'Base chain reorganization recovered; orphaned data removed',
    );

    return true;
  }

  return false;
};

export default reconcileBaseChain;
