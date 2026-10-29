import type { Log, Address } from 'viem';
import { getAbiItem, decodeEventLog, toEventSelector } from 'viem';

import Launch from '../../models/Launch';
import getBaseContext from './getBaseContext';
import BaseCursor from '../../models/BaseCursor';
import launchAbi from '../../constants/base/launchAbi';
import commitBaseScanBlock from './commitBaseScanBlock';
import factoryAbi from '../../constants/base/factoryAbi';
import type { BaseScanMode } from '../../types/base/launch';
import markBaseImagesForCleanup from './markBaseImagesForCleanup';

const scanBaseNetwork = async (
  network: 'testnet' | 'public',
  mode: BaseScanMode = 'history',
): Promise<void> => {
  const context = await getBaseContext(network);
  const { configuration, client } = context;

  const cursor = await BaseCursor.findOne({
    network,
    factoryAddress: configuration.factoryAddress,
  }).lean();

  const latest = await client.getBlockNumber();
  const end =
    mode === 'history' && cursor?.historyEndBlock ? BigInt(cursor.historyEndBlock) : latest;
  const head = latest < end ? latest : end;
  const nextBlock = mode === 'live' ? cursor?.nextLiveBlock : cursor?.nextBlock;

  if (nextBlock === undefined || nextBlock === null) {
    return;
  }

  const fromBlock = BigInt(nextBlock);

  const toBlock =
    head < fromBlock + configuration.batchSize - 1n
      ? head
      : fromBlock + configuration.batchSize - 1n;

  if (toBlock < fromBlock) {
    if (mode === 'history') {
      await markBaseImagesForCleanup(network);
    }

    return;
  }

  const factoryLogs = await client.getLogs({
    address: configuration.factoryAddress,
    fromBlock,
    toBlock,
  });

  const launches = await Launch.find({
    chain: 'base',
    network,
    factoryContractId: configuration.factoryAddress,
  })
    .select('contractId asset')
    .lean();

  const addresses = new Set<Address>();

  for (const launch of launches) {
    addresses.add(launch.contractId as Address);

    addresses.add(launch.asset as Address);
  }

  for (const log of factoryLogs) {
    if (
      log.topics[0] === toEventSelector('LaunchCreated(uint256,address,address,address,uint256)')
    ) {
      const { args } = decodeEventLog({
        abi: factoryAbi,
        data: log.data,
        topics: log.topics,
        eventName: 'LaunchCreated',
        strict: true,
      });

      addresses.add(args.curve);

      const config = await client.readContract({
        address: args.curve,
        abi: launchAbi,
        functionName: 'get_config',
        blockNumber: log.blockNumber!,
      });

      addresses.add(config.params.asset);
    }
  }

  const logs: Log[] = [...factoryLogs];

  if (mode === 'live') {
    logs.push(
      ...(await client.getLogs({
        events: [
          getAbiItem({ abi: launchAbi, name: 'Bought' }),
          getAbiItem({ abi: launchAbi, name: 'Sold' }),
        ],
        fromBlock,
        toBlock,
      })),
    );
  }

  const targets = [...addresses];

  for (let index = 0; index < targets.length; index += 50) {
    logs.push(
      ...(await client.getLogs({
        address: targets.slice(index, index + 50),
        fromBlock,
        toBlock,
      })),
    );
  }

  const blocks = new Map<bigint, Log[]>();
  const seen = new Set<string>();

  for (const log of logs) {
    if (log.blockNumber === null || log.blockHash === null || log.removed) {
      throw new Error('RPC returned a non-canonical Base log');
    }

    const position = `${log.transactionHash}:${log.logIndex}`;

    if (seen.has(position)) {
      continue;
    }

    seen.add(position);

    const group = blocks.get(log.blockNumber) ?? [];

    group.push(log);

    blocks.set(log.blockNumber, group);
  }

  // A checkpoint for an empty range is still needed for recovery and progress.
  if (!blocks.has(toBlock)) {
    blocks.set(toBlock, []);
  }

  const ordered = [...blocks.keys()].sort((left, right): number =>
    left < right ? -1 : left > right ? 1 : 0,
  );

  let expectedNextBlock = fromBlock.toString();

  for (const number of ordered) {
    const block = await client.getBlock({ blockNumber: number });
    const blockLogs = blocks.get(number)!;

    if (blockLogs.some((log): boolean => log.blockHash !== block.hash)) {
      throw new Error('Base log batch changed while scanning');
    }

    const committed = await commitBaseScanBlock(context, {
      number,
      hash: block.hash!,
      timestamp: block.timestamp,
      logs: blockLogs,
      advance: true,
      refreshDue: number === toBlock,
      mode,
      expectedNextBlock,
    });

    if (!committed) {
      return;
    }

    expectedNextBlock = (number + 1n).toString();
  }
};

export default scanBaseNetwork;
