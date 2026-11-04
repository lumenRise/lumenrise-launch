import type { Hex } from 'viem';
import { toEventSelector } from 'viem';

import Launch from '../../models/Launch';
import getBaseContext from './getBaseContext';
import getBaseRuntime from './getBaseRuntime';
import readBaseTrades from './readBaseTrades';
import acquireBaseLease from './acquireBaseLease';
import releaseBaseLease from './releaseBaseLease';
import processBaseBlock from './processBaseBlock';
import reconcileBaseChain from './reconcileBaseChain';
import rejectBaseTransaction from './rejectBaseTransaction';
import toTradeResult from '../../utils/launch/toTradeResult';
import type { BaseTransactionJob } from '../../types/base/job';
import getLaunchScales from '../../utils/launch/getLaunchScales';

const processBaseTransaction = async (
  job: BaseTransactionJob,
): Promise<Record<string, unknown>> => {
  const context = await getBaseContext(job.network);
  const writer = await acquireBaseLease(context);

  if (!writer) {
    throw new Error('Base writer is busy');
  }

  try {
    getBaseRuntime(job.network).blocks.clear();

    if (await reconcileBaseChain(writer)) {
      const runtime = getBaseRuntime(job.network);

      runtime.historyActive = true;

      runtime.factoryAt = 0;

      runtime.poolAt = 0;
    }

    const receipt = await context.client.getTransactionReceipt({
      hash: job.transactionHash as Hex,
    });

    if (receipt.status !== 'success') {
      rejectBaseTransaction('Transaction failed');
    }

    if (
      receipt.transactionHash.toLowerCase() !== job.transactionHash ||
      receipt.logs.some(
        (event): boolean => event.transactionHash?.toLowerCase() !== job.transactionHash,
      )
    ) {
      throw new Error('Base receipt hash mismatch');
    }

    const block = await context.client.getBlock({ blockNumber: receipt.blockNumber });

    if (block.hash !== receipt.blockHash || block.number !== receipt.blockNumber) {
      throw new Error('Base transaction is no longer canonical');
    }

    const creations = receipt.logs.filter(
      (event): boolean =>
        event.address.toLowerCase() === context.configuration.factoryAddress &&
        event.topics[0] ===
          toEventSelector('LaunchCreated(uint256,address,address,address,uint256)'),
    );

    if (job.action === 'launch' && creations.length === 0) {
      rejectBaseTransaction('No configured factory launch in transaction');
    }

    const identity = { chain: 'base' as const, network: job.network, contractId: job.contractId };

    const launch =
      job.action === 'trade'
        ? await Launch.findOne({
            ...identity,
            factoryContractId: context.configuration.factoryAddress,
          }).lean()
        : null;

    if (job.action === 'trade' && !launch) {
      throw new Error('Launch is not indexed yet');
    }

    writer.receipts = new Map([[receipt.transactionHash, receipt]]);

    const trades = launch
      ? await readBaseTrades(writer, launch, receipt.logs, block.timestamp)
      : [];

    if (job.action === 'trade' && trades.length === 0) {
      rejectBaseTransaction('Transaction has no trade for this launch');
    }

    await processBaseBlock({
      context: writer,
      number: block.number,
      hash: block.hash!,
      timestamp: block.timestamp,
      logs: receipt.logs,
      verifiedBlock: true,
    });

    if (launch) {
      return {
        blockNumber: Number(block.number),
        trade: toTradeResult(trades[0]!, launch.asset),
        trades: trades.map((trade) => toTradeResult(trade, launch.asset)),
        pair: launch.pair,
        ...getLaunchScales(launch),
      };
    }

    const launches = await Launch.find({
      chain: 'base',
      network: job.network,
      factoryContractId: context.configuration.factoryAddress,
      creationTransactionHash: job.transactionHash,
    }).lean();

    if (launches.length !== creations.length) {
      throw new Error('Confirmed launch registration is incomplete');
    }

    return {
      blockNumber: Number(block.number),
      launchContracts: launches.map((item): string => item.contractId),
    };
  } finally {
    await releaseBaseLease(writer);
  }
};

export default processBaseTransaction;
