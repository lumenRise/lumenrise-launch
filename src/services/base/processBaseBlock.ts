import mongoose from 'mongoose';
import type { Log } from 'viem';
import { decodeEventLog, toEventSelector } from 'viem';

import log from '../../logger';
import Launch from '../../models/Launch';
import readBaseTrades from './readBaseTrades';
import indexBaseLaunch from './indexBaseLaunch';
import BaseCursor from '../../models/BaseCursor';
import LaunchTrade from '../../models/LaunchTrade';
import refreshBaseMarket from './refreshBaseMarket';
import tokenAbi from '../../constants/base/tokenAbi';
import findBaseSwapLaunch from './findBaseSwapLaunch';
import BaseCheckpoint from '../../models/BaseCheckpoint';
import type { BaseBlockInput } from '../../types/base/launch';
import type { BaseIndexedEvent } from '../../types/base/launch';
import uniswapDeployments from '../../constants/base/uniswapDeployments';
import type { LaunchData as LaunchRecord } from '../../types/launch/model';

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

  const indexed = await mongoose.connection.transaction(async (session) => {
    const events: BaseIndexedEvent[] = [];

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

    const eventContext = { ...context, session, events };

    const logs = [...input.logs].sort(
      (left, right): number => (left.logIndex ?? -1) - (right.logIndex ?? -1),
    );

    // Discover all launches first, including creation plus first buy in one transaction.
    for (const log of logs) {
      if (
        log.address.toLowerCase() === configuration.factoryAddress &&
        log.topics[0] === toEventSelector('LaunchCreated(uint256,address,address,address,uint256)')
      ) {
        const launch = await indexBaseLaunch(eventContext, log, timestamp);

        if (launch) {
          events.push({ message: 'Base new launch indexed', data: launch });
        }
      }
    }

    // Discover a newly graduated pool before swaps, even within the same transaction.
    for (const event of logs) {
      if (event.topics[0] !== toEventSelector('Graduated(uint256,uint256)')) {
        continue;
      }

      const launch = await Launch.findOne({
        chain: 'base',
        network: configuration.network,
        contractId: event.address.toLowerCase(),
        factoryContractId: configuration.factoryAddress,
      })
        .session(session)
        .lean();

      if (launch) {
        await refreshBaseMarket(eventContext, launch.contractId, number, timestamp, []);
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

    const swapLaunchCache = new Map<string, LaunchRecord | null>();
    const tradeGroups = new Map<string, { launch: LaunchRecord; logs: Log[] }>();

    for (const log of logs) {
      if (log.topics[0] === toEventSelector('Transfer(address,address,uint256)')) {
        const launches = await Launch.find({
          chain: 'base',
          network: configuration.network,
          asset: log.address.toLowerCase(),
          factoryContractId: configuration.factoryAddress,
          creationLedger: { $lte: Number(number) },
        })
          .session(session)
          .lean();

        if (launches.length === 0) {
          continue;
        }

        const { args } = decodeEventLog({
          abi: tokenAbi,
          data: log.data,
          topics: log.topics,
          eventName: 'Transfer',
          strict: true,
        });

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

      const isSwap =
        log.address.toLowerCase() === uniswapDeployments[configuration.network].poolManager &&
        log.topics[0] ===
          toEventSelector('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)');

      if (
        !isSwap &&
        log.topics[0] !== toEventSelector('Bought(address,uint256,uint256,uint256)') &&
        log.topics[0] !== toEventSelector('Sold(address,uint256,uint256,uint256)')
      ) {
        continue;
      }

      if (isSwap && !swapLaunchCache.has(log.topics[1]!)) {
        swapLaunchCache.set(
          log.topics[1]!,
          await findBaseSwapLaunch(eventContext, log.topics[1]!, number),
        );
      }

      const launch = isSwap
        ? swapLaunchCache.get(log.topics[1]!)
        : await Launch.findOne({
            chain: 'base',
            network: configuration.network,
            contractId: log.address.toLowerCase(),
            factoryContractId: configuration.factoryAddress,
          })
            .session(session)
            .lean();

      if (!launch) {
        // Ignore identically named events from contracts outside our factory registry.
        continue;
      }

      const group = tradeGroups.get(launch.contractId) ?? { launch, logs: [] };

      group.logs.push(log);

      tradeGroups.set(launch.contractId, group);
    }

    for (const { launch, logs: tradeLogs } of tradeGroups.values()) {
      const trades = await readBaseTrades(eventContext, launch, tradeLogs, timestamp);

      for (const trade of trades) {
        const result = await LaunchTrade.updateOne(
          {
            chain: 'base',
            network: trade.network,
            transactionHash: trade.transactionHash,
            operationIndex: trade.operationIndex,
          },
          { $setOnInsert: trade },
          { upsert: true, session },
        );

        if (result.upsertedCount === 1) {
          events.push({
            message: trade.side === 'buy' ? 'Base buy indexed' : 'Base sell indexed',
            data: {
              ...trade,
              blockNumber: number.toString(),
              assetDecimals: launch.assetDecimals,
              pairDecimals: launch.pairDecimals,
            },
          });
        }

        const addresses = traders.get(trade.contractId) ?? [];

        addresses.push(trade.trader);

        traders.set(trade.contractId, addresses);
      }
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
      const field = input.mode === 'live' ? 'nextLiveBlock' : 'nextBlock';

      const progress = await BaseCursor.updateOne(
        {
          ...key,
          leaseOwner,
          ...(input.expectedNextBlock === undefined ? {} : { [field]: input.expectedNextBlock }),
        },
        {
          $set:
            input.mode === 'live'
              ? { nextLiveBlock: (number + 1n).toString(), lastLiveScannedAt: new Date() }
              : {
                  nextBlock: (number + 1n).toString(),
                  previousBlockHash: hash,
                  lastScannedAt: new Date(),
                },
        },
        { session },
      );

      if (progress.matchedCount !== 1) {
        throw new Error('Base scan cursor changed before commit');
      }
    }

    return events;
  });

  for (const event of indexed) {
    log.info(event.data, event.message);
  }
};

export default processBaseBlock;
