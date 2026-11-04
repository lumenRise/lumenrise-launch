import { toEventSelector } from 'viem';
import type { Log, Address } from 'viem';

import readBaseLaunch from './readBaseLaunch';
import decodeBaseTrade from './decodeBaseTrade';
import decodeBasePoolTrade from './decodeBasePoolTrade';
import type { TradeRecord } from '../../types/launch/market';
import type { BaseContext } from '../../types/base/configuration';
import uniswapDeployments from '../../constants/base/uniswapDeployments';
import type { LaunchData as LaunchRecord } from '../../types/launch/model';

const readBaseTrades = async (
  context: BaseContext,
  launch: LaunchRecord,
  logs: Log[],
  timestamp: bigint,
): Promise<TradeRecord[]> => {
  const trades: TradeRecord[] = [];
  const deployment = uniswapDeployments[context.configuration.network];

  const curveLogs = logs.filter(
    (event): boolean =>
      event.address.toLowerCase() === launch.contractId &&
      (event.topics[0] === toEventSelector('Bought(address,uint256,uint256,uint256)') ||
        event.topics[0] === toEventSelector('Sold(address,uint256,uint256,uint256)')),
  );

  if (curveLogs.length > 0) {
    for (const event of curveLogs) {
      if (
        launch.graduationBlock != null &&
        (Number(event.blockNumber) > launch.graduationBlock ||
          (Number(event.blockNumber) === launch.graduationBlock &&
            launch.graduationLogIndex != null &&
            event.logIndex! > launch.graduationLogIndex))
      ) {
        continue;
      }

      trades.push(
        decodeBaseTrade({
          log: event,
          network: context.configuration.network,
          timestamp,
          assetDecimals: launch.assetDecimals!,
        }),
      );
    }
  }

  const swaps = logs.filter(
    (event): boolean =>
      event.address.toLowerCase() === deployment.poolManager &&
      event.topics[0] ===
        toEventSelector('Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)'),
  );

  if (swaps.length > 0) {
    const snapshot = launch.pool
      ? { pool: launch.pool }
      : await readBaseLaunch({
          context,
          address: launch.contractId as Address,
          blockNumber: swaps[0]!.blockNumber!,
        });

    if (!snapshot.pool) {
      return trades;
    }

    const senders = new Map<string, Address>();

    for (const event of swaps) {
      if (event.topics[1]?.toLowerCase() !== snapshot.pool.poolId) {
        continue;
      }

      let sender = senders.get(event.transactionHash!);

      if (!sender) {
        const receipt =
          context.receipts?.get(event.transactionHash!) ??
          (await context.client.getTransactionReceipt({
            hash: event.transactionHash!,
          }));

        if (
          receipt.status !== 'success' ||
          receipt.blockHash !== event.blockHash ||
          receipt.transactionHash !== event.transactionHash
        ) {
          throw new Error('Base swap receipt is no longer canonical');
        }

        // The event sender is usually a router. Attribute to the transaction sender.
        sender = receipt.from;

        senders.set(event.transactionHash!, sender);
      }

      trades.push(
        decodeBasePoolTrade({
          network: context.configuration.network,
          contractId: launch.contractId,
          asset: launch.asset,
          assetDecimals: launch.assetDecimals!,
          pool: snapshot.pool,
          log: event,
          timestamp,
          trader: sender,
        }),
      );
    }
  }

  return trades.sort((left, right): number => left.operationIndex - right.operationIndex);
};

export default readBaseTrades;
