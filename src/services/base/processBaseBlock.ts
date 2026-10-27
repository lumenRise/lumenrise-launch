import mongoose from 'mongoose';
import { decodeEventLog, toEventSelector } from 'viem';

import Launch from '../../models/Launch';
import decodeBaseTrade from './decodeBaseTrade';
import indexBaseLaunch from './indexBaseLaunch';
import BaseCursor from '../../models/BaseCursor';
import LaunchTrade from '../../models/LaunchTrade';
import refreshBaseMarket from './refreshBaseMarket';
import tokenAbi from '../../constants/base/tokenAbi';
import BaseCheckpoint from '../../models/BaseCheckpoint';
import type { BaseBlockInput } from '../../types/base/launch';

const processBaseBlock = async (input: BaseBlockInput): Promise<void> => {
  const { context, number, hash, timestamp } = input;
  const { configuration, leaseOwner } = context;
  const key = { network: configuration.network, factoryAddress: configuration.factoryAddress };

  if (
    input.logs.some(
      (event): boolean => event.blockNumber !== number || event.blockHash !== hash || event.removed,
    )
  ) {
    throw new Error('Base log position differs from its block');
  }

  const canonical = await context.client.getBlock({ blockNumber: number });

  if (canonical.hash !== hash) {
    throw new Error('Base block changed before ingestion; retry after reconciliation');
  }

  await mongoose.connection.transaction(async (session): Promise<void> => {
    const locked = await BaseCursor.updateOne(
      { ...key, leaseOwner, leaseUntil: { $gt: new Date() } },
      { $set: { leaseUntil: new Date(Date.now() + 300_000) } },
      { session },
    );

    if (locked.matchedCount !== 1) {
      throw new Error('Base ingestion lease expired');
    }

    const previous = await BaseCheckpoint.findOne({ ...key, blockNumber: Number(number) })
      .session(session)
      .lean();

    if (previous && previous.blockHash !== hash) {
      throw new Error('Base block conflicts with stored checkpoint');
    }

    const eventContext = { ...context, session };

    const logs = [...input.logs].sort(
      (left, right): number => (left.logIndex ?? -1) - (right.logIndex ?? -1),
    );

    // Discover all launches first, including creation plus first buy in one transaction.
    for (const log of logs) {
      if (
        log.address.toLowerCase() === configuration.factoryAddress &&
        log.topics[0] === toEventSelector('LaunchCreated(address,address,uint32)')
      ) {
        await indexBaseLaunch(eventContext, log, timestamp);
      }
    }

    const traders = new Map<string, string[]>();

    if (input.refreshDue) {
      const due = await Launch.find({
        chain: 'base',
        network: configuration.network,
        factoryContractId: configuration.factoryAddress,
        $or: [{ nextStatePollAt: null }, { nextStatePollAt: { $lte: new Date() } }],
      })
        .limit(2)
        .session(session)
        .lean();

      for (const launch of due) {
        if (
          launch.creationLedger !== null &&
          launch.creationLedger !== undefined &&
          launch.creationLedger <= Number(number)
        ) {
          traders.set(launch.contractId, []);
        }
      }
    }

    for (const log of logs) {
      if (log.topics[0] === toEventSelector('Transfer(address,address,uint256)')) {
        const { args } = decodeEventLog({
          abi: tokenAbi,
          data: log.data,
          topics: log.topics,
          eventName: 'Transfer',
          strict: true,
        });

        const launches = await Launch.find({
          chain: 'base',
          network: configuration.network,
          asset: log.address.toLowerCase(),
          factoryContractId: configuration.factoryAddress,
        })
          .session(session)
          .lean();

        for (const launch of launches) {
          const addresses = traders.get(launch.contractId) ?? [];

          for (const address of [args.from, args.to]) {
            if (!/^0x0{40}$/i.test(address) && address.toLowerCase() !== launch.contractId) {
              addresses.push(address.toLowerCase());
            }
          }

          traders.set(launch.contractId, addresses);
        }

        continue;
      }

      if (
        log.topics[0] !== toEventSelector('Trade(address,bool,uint128,uint128,uint128,uint128)')
      ) {
        continue;
      }

      const trade = decodeBaseTrade({ log, network: configuration.network, timestamp });

      const launch = await Launch.findOne({
        chain: 'base',
        network: configuration.network,
        contractId: trade.contractId,
        factoryContractId: configuration.factoryAddress,
      })
        .session(session)
        .lean();

      if (!launch) {
        // Ignore identically named events from contracts outside our factory registry.
        continue;
      }

      await LaunchTrade.updateOne(
        {
          chain: 'base',
          network: trade.network,
          transactionHash: trade.transactionHash,
          operationIndex: trade.operationIndex,
        },
        { $setOnInsert: trade },
        { upsert: true, session },
      );

      const addresses = traders.get(trade.contractId) ?? [];

      addresses.push(trade.trader);

      traders.set(trade.contractId, addresses);
    }

    for (const [contractId, addresses] of traders) {
      await refreshBaseMarket(eventContext, contractId, number, timestamp, addresses);
    }

    await BaseCheckpoint.updateOne(
      { ...key, blockNumber: Number(number) },
      { $setOnInsert: { blockHash: hash, finalized: false } },
      { upsert: true, session },
    );

    if (input.advance) {
      await BaseCursor.updateOne(
        { ...key, leaseOwner },
        {
          $set: {
            nextBlock: (number + 1n).toString(),
            previousBlockHash: hash,
            lastScannedAt: new Date(),
          },
        },
        { session },
      );
    }
  });
};

export default processBaseBlock;
