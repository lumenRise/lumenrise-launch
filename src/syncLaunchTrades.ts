import type { rpc } from '@stellar/stellar-sdk';
import { Address, nativeToScVal } from '@stellar/stellar-sdk';

import Launch from './store/Launch';
import LaunchTrade from './store/LaunchTrade';
import LaunchTradeCursor from './store/LaunchTradeCursor';
import type { Configuration } from './types/configuration';
import type { TradeHealthCacheEntry } from './types/market';
import decodeTradeTransaction from './chain/decodeTradeTransaction';

const healthCache = new WeakMap<rpc.Server, TradeHealthCacheEntry>();

const syncLaunchTrades = async (
  server: rpc.Server,
  configuration: Configuration,
  now = new Date(),
): Promise<number> => {
  const network = configuration.network;
  // Select one launch fairly. A new launch receives its own retention cursor,
  // so discovery never makes a global cursor skip its earlier trades.
  const missing = await Launch.aggregate([
    { $match: { network } },
    {
      $lookup: {
        from: 'launch_trade_cursors',
        let: { id: '$contractId' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$contractId', '$$id'] },
                  { $eq: ['$network', network] },
                ],
              },
            },
          },
        ],
        as: 'tradeCursor',
      },
    },
    { $match: { tradeCursor: { $size: 0 } } },
    { $limit: 1 },
    { $project: { contractId: 1 } },
  ]);

  const due = missing.length
    ? null
    : await LaunchTradeCursor.findOne({ network, nextPollAt: { $lte: now } })
        .sort({ nextPollAt: 1, contractId: 1 })
        .lean();

  const contractId =
    due?.contractId ?? (missing?.[0]?.contractId as string | undefined);

  if (!contractId) {
    return 0;
  }

  const launch = await Launch.findOne({ network, contractId }).lean();

  if (!launch) {
    throw new Error('Trade cursor references a missing launch');
  }

  const identity = { network, contractId };
  // A two-minute lease covers the bounded RPC page and prevents two workers
  // from scanning the same target. Failures leave its previous cursor intact.
  const leaseUntil = new Date(now.getTime() + 120_000);

  try {
    const reservation = due
      ? await LaunchTradeCursor.updateOne(
          { ...identity, nextPollAt: { $lte: now } },
          { $set: { nextPollAt: leaseUntil } },
        )
      : await LaunchTradeCursor.updateOne(
          identity,
          {
            $setOnInsert: {
              cursor: null,
              nextLedger: 0,
              coverageFrom: now,
              scannedThroughLedger: 0,
              scannedAt: new Date(0),
              historyGap: false,
              unclassifiedCount: 0,
              nextPollAt: leaseUntil,
            },
          },
          { upsert: true },
        );

    if (
      due ? reservation.matchedCount !== 1 : reservation.upsertedCount !== 1
    ) {
      return 0;
    }
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    ) {
      return 0;
    }

    throw error;
  }

  let cached = healthCache.get(server);

  if (!cached || cached.expiresAt <= now.getTime()) {
    cached = {
      value: await server.getHealth(),
      expiresAt: now.getTime() + 60_000,
    };

    healthCache.set(server, cached);
  }

  const health = cached.value;
  const expired =
    !!due && due.nextLedger > 0 && due.nextLedger < health.oldestLedger;
  const cursor = expired ? null : due?.cursor;
  const startLedger = Math.max(due?.nextLedger ?? 0, health.oldestLedger);
  const transfer = nativeToScVal('transfer', { type: 'symbol' }).toXDR(
    'base64',
  );
  const addressTopic = new Address(contractId).toScVal().toXDR('base64');

  const filters: rpc.Api.EventFilter[] = [
    {
      type: 'contract',
      contractIds: [launch.asset],
      topics: [
        [transfer, addressTopic, '*'],
        [transfer, '*', addressTopic],
        [transfer, addressTopic, '*', '*'],
        [transfer, '*', addressTopic, '*'],
      ],
    },
  ];

  const page = await server.getEvents(
    cursor ? { filters, cursor, limit: 5 } : { filters, startLedger, limit: 5 },
  );

  let indexed = 0;
  let unclassified = 0;

  for (const hash of new Set(page.events.map((event) => event.txHash))) {
    const existing = await LaunchTrade.exists({
      network,
      transactionHash: hash,
      operationIndex: 0,
    });

    if (existing) {
      continue;
    }

    const transaction = await server.getTransaction(hash);

    if (transaction.status === 'NOT_FOUND') {
      throw new Error(
        'Trade candidate is temporarily unavailable; retaining cursor',
      );
    }

    const trade = decodeTradeTransaction(transaction, launch);

    if (trade) {
      await LaunchTrade.updateOne(
        {
          network,
          transactionHash: hash,
          operationIndex: trade.operationIndex,
        },
        { $setOnInsert: trade },
        { upsert: true },
      );
      indexed += 1;
    } else {
      unclassified += 1;
    }
  }
  const last = page.events.at(-1);
  const caughtUp = page.events.length < 5;
  const liveDelay = launch.state?.graduated === true ? 3_600_000 : 30_000;

  await LaunchTradeCursor.updateOne(identity, {
    $set: {
      cursor: page.cursor,
      nextLedger: caughtUp ? page.latestLedger : last!.ledger,
      scannedThroughLedger: caughtUp ? page.latestLedger : last!.ledger - 1,
      scannedAt: now,
      nextPollAt: new Date(now.getTime() + (caughtUp ? liveDelay : 5000)),
      ...(!due || due.nextLedger === 0 || expired
        ? {
            coverageFrom:
              due && due.nextLedger > 0
                ? due.coverageFrom
                : /^\d+$/.test(page.oldestLedgerCloseTime)
                  ? new Date(Number(page.oldestLedgerCloseTime) * 1000)
                  : new Date(page.oldestLedgerCloseTime),
            historyGap: expired || !!due?.historyGap,
          }
        : {}),
    },
    $inc: { unclassifiedCount: unclassified },
  });

  return indexed;
};

export default syncLaunchTrades;
