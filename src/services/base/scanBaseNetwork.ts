import type { Log, Hex, Address } from 'viem';
import { getAbiItem, toEventSelector } from 'viem';

import Launch from '../../models/Launch';
import readBaseLogs from './readBaseLogs';
import readBaseBlock from './readBaseBlock';
import getBaseContext from './getBaseContext';
import getBaseRuntime from './getBaseRuntime';
import BaseCursor from '../../models/BaseCursor';
import acquireBaseLease from './acquireBaseLease';
import releaseBaseLease from './releaseBaseLease';
import processBaseBlock from './processBaseBlock';
import poolAbi from '../../constants/base/poolAbi';
import reconcileBaseChain from './reconcileBaseChain';
import launchAbi from '../../constants/base/launchAbi';
import factoryAbi from '../../constants/base/factoryAbi';
import type { BaseScanMode } from '../../types/base/launch';
import uniswapDeployments from '../../constants/base/uniswapDeployments';

const scanBaseNetwork = async (
  network: 'testnet' | 'public',
  mode: BaseScanMode = 'history',
): Promise<boolean> => {
  const runtime = getBaseRuntime(network);

  runtime.progress.set(mode, false);

  if (runtime.head === undefined) {
    return false;
  }

  const readContext = await getBaseContext(network);

  if (
    mode === 'pool' &&
    !(await Launch.exists({
      chain: 'base',
      network,
      factoryContractId: readContext.configuration.factoryAddress,
      'state.graduated': true,
      'pool.poolId': { $type: 'string' },
    }))
  ) {
    return true;
  }

  if (mode === 'history') {
    const progress = await BaseCursor.findOne({
      network,
      factoryAddress: readContext.configuration.factoryAddress,
    }).lean();

    if (
      progress?.historyEndBlock != null &&
      BigInt(progress.nextBlock) > BigInt(progress.historyEndBlock)
    ) {
      return true;
    }
  }

  const context = await acquireBaseLease(readContext);

  if (!context) {
    return false;
  }

  try {
    const { configuration } = context;

    runtime.blocks.clear();

    if (await reconcileBaseChain(context)) {
      runtime.historyActive = true;

      runtime.factoryAt = 0;

      runtime.poolAt = 0;

      return false;
    }

    runtime.checkAt = Date.now() + 60_000;

    const key = { network, factoryAddress: configuration.factoryAddress };
    const cursor = await BaseCursor.findOne(key).lean();

    if (!cursor) {
      return false;
    }

    const scope = {
      chain: 'base' as const,
      network,
      factoryContractId: configuration.factoryAddress,
    };

    const launches = await Launch.find(scope).lean();

    const pools = launches.filter((launch): boolean =>
      Boolean(launch.state.graduated && launch.pool),
    );

    const end = mode === 'history' ? BigInt(cursor.historyEndBlock ?? '-1') : runtime.head;
    const head = end < runtime.head ? end : runtime.head;

    const poolStarts = pools.map((launch): bigint =>
      BigInt(
        launch.poolNextBlock ??
          String(
            Math.max(
              launch.graduationBlock ?? launch.stateAsOfLedger,
              launch.tradeCoverageFrom ?? 0,
            ),
          ),
      ),
    );

    if (mode === 'pool' && poolStarts.length === 0) {
      return true;
    }

    const next = mode === 'history' ? cursor.nextBlock : cursor.nextLiveBlock;

    if (mode !== 'pool' && next == null) {
      return false;
    }

    const fromBlock =
      mode === 'pool'
        ? poolStarts.reduce((left, right): bigint => (left < right ? left : right))
        : BigInt(next!);

    if (fromBlock > head) {
      return true;
    }

    const toBlock =
      head < fromBlock + configuration.batchSize - 1n
        ? head
        : fromBlock + configuration.batchSize - 1n;

    const logs: Log[] = [];

    if (mode === 'pool') {
      const eligible = pools.filter((_launch, index): boolean => poolStarts[index]! <= toBlock);

      for (let index = 0; index < eligible.length; index += 50) {
        const ids = eligible
          .slice(index, index + 50)
          .map((launch): Hex => launch.pool!.poolId as Hex);

        logs.push(
          ...(await readBaseLogs(context, {
            address: uniswapDeployments[network].poolManager,
            event: poolAbi[0],
            args: { id: ids },
            fromBlock,
            toBlock,
          })),
        );
      }
    } else {
      const curves = launches.filter(
        (launch): boolean =>
          !launch.pool ||
          launch.graduationBlock == null ||
          launch.graduationBlock >= Number(fromBlock),
      );

      const targets: Address[] = [
        configuration.factoryAddress,
        ...curves.map((launch): Address => launch.contractId as Address),
      ];

      for (let index = 0; index < targets.length; index += 50) {
        logs.push(
          ...(await readBaseLogs(context, {
            address: targets.slice(index, index + 50),
            events: [
              getAbiItem({ abi: factoryAbi, name: 'LaunchCreated' }),
              getAbiItem({ abi: launchAbi, name: 'Bought' }),
              getAbiItem({ abi: launchAbi, name: 'Sold' }),
              getAbiItem({ abi: launchAbi, name: 'Graduated' }),
            ],
            fromBlock,
            toBlock,
          })),
        );
      }
    }

    const blocks = new Map<bigint, Log[]>();
    const seen = new Set<string>();

    for (const event of logs) {
      if (
        event.blockNumber === null ||
        event.blockHash === null ||
        event.removed ||
        event.blockNumber < fromBlock ||
        event.blockNumber > toBlock
      ) {
        throw new Error('RPC returned a non-canonical Base log');
      }

      const position = `${event.transactionHash}:${event.logIndex}`;

      const isCreation =
        event.address.toLowerCase() === configuration.factoryAddress &&
        event.topics[0] ===
          toEventSelector('LaunchCreated(uint256,address,address,address,uint256)');

      const launch =
        mode === 'pool'
          ? pools.find(
              (item): boolean => item.pool!.poolId.toLowerCase() === event.topics[1]?.toLowerCase(),
            )
          : launches.find((item): boolean => item.contractId === event.address.toLowerCase());

      const coverage = launch
        ? mode === 'pool'
          ? BigInt(
              launch.poolNextBlock ??
                String(
                  Math.max(
                    launch.graduationBlock ?? launch.stateAsOfLedger,
                    launch.tradeCoverageFrom ?? 0,
                  ),
                ),
            )
          : BigInt(launch.tradeCoverageFrom ?? launch.creationLedger ?? 0)
        : null;

      if (
        seen.has(position) ||
        (!isCreation && (coverage === null || event.blockNumber < coverage))
      ) {
        continue;
      }

      seen.add(position);

      const group = blocks.get(event.blockNumber) ?? [];

      group.push(event);

      blocks.set(event.blockNumber, group);
    }

    if (!blocks.has(toBlock)) {
      blocks.set(toBlock, []);
    }

    const ordered = [...blocks.keys()].sort((left, right): number =>
      left < right ? -1 : left > right ? 1 : 0,
    );

    let expectedNextBlock = fromBlock.toString();

    for (const number of ordered) {
      const block = await readBaseBlock(context, number);
      const blockLogs = blocks.get(number)!;

      if (!block.hash || blockLogs.some((event): boolean => event.blockHash !== block.hash)) {
        throw new Error('Base log batch changed while scanning');
      }

      await processBaseBlock({
        context,
        number,
        hash: block.hash,
        timestamp: block.timestamp,
        logs: blockLogs,
        verifiedBlock: true,
        advance: mode !== 'pool',
        refreshDue: number === toBlock && mode !== 'history',
        mode,
        expectedNextBlock,
        coverageFrom: Number(toBlock + 1n),
      });

      expectedNextBlock = (number + 1n).toString();
    }

    if (mode === 'pool') {
      const locked = await BaseCursor.updateOne(
        { ...key, leaseOwner: context.leaseOwner, leaseUntil: { $gt: new Date() } },
        { $set: { leaseUntil: new Date(Date.now() + 300_000) } },
      );

      if (locked.matchedCount !== 1) {
        throw new Error('Base pool scan lease expired');
      }

      for (const launch of pools) {
        if (BigInt(launch.poolNextBlock ?? '0') > toBlock) {
          continue;
        }

        await Launch.updateOne(
          { ...scope, contractId: launch.contractId, 'pool.poolId': launch.pool!.poolId },
          { $set: { poolNextBlock: (toBlock + 1n).toString() } },
        );
      }
    }

    runtime.progress.set(mode, true);

    return toBlock === head;
  } finally {
    runtime.blocks.clear();

    await releaseBaseLease(context);
  }
};

export default scanBaseNetwork;
