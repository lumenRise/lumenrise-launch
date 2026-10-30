import type { Log } from 'viem';
import { getAbiItem, decodeEventLog, toEventSelector } from 'viem';

import Launch from '../../models/Launch';
import processBaseBlock from './processBaseBlock';
import tokenAbi from '../../constants/base/tokenAbi';
import factoryAbi from '../../constants/base/factoryAbi';
import findBaseLaunchCreation from './findBaseLaunchCreation';
import type { BaseWriteContext } from '../../types/base/launch';

const recoverUnknownBaseLaunches = async (
  context: BaseWriteContext,
  logs: Log[],
): Promise<Log[]> => {
  const allowed = new Map<string, boolean>();
  const recoveredLogs: Log[] = [...logs];

  for (const event of logs) {
    if (
      event.address.toLowerCase() === context.configuration.factoryAddress &&
      event.topics[0] === toEventSelector('LaunchCreated(uint256,address,address,address,uint256)')
    ) {
      const { args } = decodeEventLog({
        abi: factoryAbi,
        eventName: 'LaunchCreated',
        data: event.data,
        topics: event.topics,
        strict: true,
      });

      allowed.set(args.curve.toLowerCase(), true);
    }
  }

  for (const event of logs) {
    if (
      event.topics[0] !== toEventSelector('Bought(address,uint256,uint256,uint256)') &&
      event.topics[0] !== toEventSelector('Sold(address,uint256,uint256,uint256)')
    ) {
      continue;
    }

    const address = event.address.toLowerCase();

    if (allowed.has(address)) {
      continue;
    }

    const existing = await Launch.exists({
      chain: 'base',
      network: context.configuration.network,
      factoryContractId: context.configuration.factoryAddress,
      contractId: address,
    });

    if (existing) {
      allowed.set(address, true);

      continue;
    }

    if (event.blockNumber === null || event.blockHash === null || event.removed) {
      throw new Error('Unknown Base trade has invalid block position');
    }

    const creation = await findBaseLaunchCreation(context, event.address, event.blockNumber);

    if (!creation) {
      allowed.set(address, false);

      continue;
    }

    await processBaseBlock({
      context,
      number: creation.number,
      hash: creation.hash,
      timestamp: creation.timestamp,
      logs: [creation.event],
    });

    const transfers = await context.client.getLogs({
      address: creation.asset,
      event: getAbiItem({ abi: tokenAbi, name: 'Transfer' }),
      fromBlock: event.blockNumber,
      toBlock: event.blockNumber,
    });

    recoveredLogs.push(...transfers);

    allowed.set(address, true);
  }

  const seen = new Set<string>();

  return recoveredLogs.filter((event): boolean => {
    const position = `${event.transactionHash}:${event.logIndex}`;

    if (allowed.get(event.address.toLowerCase()) === false || seen.has(position)) {
      return false;
    }

    seen.add(position);

    return true;
  });
};

export default recoverUnknownBaseLaunches;
