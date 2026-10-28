import type { Log, Address } from 'viem';
import { decodeEventLog, toEventSelector } from 'viem';

import Launch from '../../models/Launch';
import getBaseContext from './getBaseContext';
import BaseCursor from '../../models/BaseCursor';
import acquireBaseLease from './acquireBaseLease';
import releaseBaseLease from './releaseBaseLease';
import processBaseBlock from './processBaseBlock';
import reconcileBaseChain from './reconcileBaseChain';
import launchAbi from '../../constants/base/launchAbi';
import factoryAbi from '../../constants/base/factoryAbi';
import markBaseImagesForCleanup from './markBaseImagesForCleanup';

const scanBaseNetwork = async (network: 'testnet' | 'public'): Promise<void> => {
  const context = await acquireBaseLease(await getBaseContext(network));

  if (!context) {
    return;
  }

  try {
    await reconcileBaseChain(context);

    const { configuration, client } = context;

    const cursor = await BaseCursor.findOne({
      network,
      factoryAddress: configuration.factoryAddress,
    }).lean();

    const head = await client.getBlockNumber();
    const fromBlock = BigInt(cursor!.nextBlock);

    const toBlock =
      head < fromBlock + configuration.batchSize - 1n
        ? head
        : fromBlock + configuration.batchSize - 1n;

    if (toBlock < fromBlock) {
      await markBaseImagesForCleanup(network);

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
      if (log.topics[0] === toEventSelector('LaunchCreated(address,address,uint32)')) {
        const { args } = decodeEventLog({
          abi: factoryAbi,
          data: log.data,
          topics: log.topics,
          eventName: 'LaunchCreated',
          strict: true,
        });

        addresses.add(args.launch);

        const config = await client.readContract({
          address: args.launch,
          abi: launchAbi,
          functionName: 'get_config',
          blockNumber: log.blockNumber!,
        });

        addresses.add(config.params.asset);
      }
    }

    const logs: Log[] = [...factoryLogs];
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

    for (const log of logs) {
      if (log.blockNumber === null || log.blockHash === null || log.removed) {
        throw new Error('RPC returned a non-canonical Base log');
      }

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

    for (const number of ordered) {
      const block = await client.getBlock({ blockNumber: number });
      const blockLogs = blocks.get(number)!;

      if (blockLogs.some((log): boolean => log.blockHash !== block.hash)) {
        throw new Error('Base log batch changed while scanning');
      }

      await processBaseBlock({
        context,
        number,
        hash: block.hash!,
        timestamp: block.timestamp,
        logs: blockLogs,
        advance: true,
        refreshDue: number === toBlock,
      });
    }
  } finally {
    await releaseBaseLease(context);
  }
};

export default scanBaseNetwork;
