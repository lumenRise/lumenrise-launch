import mongoose from 'mongoose';

import Launch from '../../models/Launch';
import getStellarRpc from './getStellarRpc';
import LaunchTrade from '../../models/LaunchTrade';
import refreshStellarMarket from './refreshStellarMarket';
import getNetworkConfig from '../network/getNetworkConfig';
import type { TradeRecord } from '../../types/launch/market';
import toTradeResult from '../../utils/launch/toTradeResult';
import refreshStellarHoldings from './refreshStellarHoldings';
import recordStellarLaunch from '../launch/recordStellarLaunch';
import decodeLaunchCreation from '../../utils/launch/decodeLaunchCreation';
import decodeTradeTransaction from '../../utils/launch/decodeTradeTransaction';
import type { StellarTransactionJob } from '../../types/stellar/transactionJob';

const processStellarTransaction = async (
  job: StellarTransactionJob,
): Promise<Record<string, unknown>> => {
  const identity = { chain: 'stellar' as const, network: job.network, contractId: job.contractId };

  const existing =
    job.action === 'trade'
      ? await LaunchTrade.findOne({
          ...identity,
          transactionHash: job.transactionHash,
          operationIndex: 0,
        }).lean()
      : null;

  let trade: TradeRecord | null = existing;

  if (!existing?.priceRecordedAt) {
    const server = getStellarRpc(job.network);
    const transaction = await server.getTransaction(job.transactionHash);

    if (transaction.status === 'NOT_FOUND') {
      throw new Error('Transaction not available yet');
    }

    if (transaction.txHash.toLowerCase() !== job.transactionHash) {
      throw new Error('Stellar transaction hash mismatch');
    }

    if (transaction.status !== 'SUCCESS') {
      const error = new Error('Transaction failed');

      error.name = 'InvalidStellarTransaction';

      throw error;
    }

    if (job.action === 'launch') {
      const contractId = decodeLaunchCreation(
        transaction,
        getNetworkConfig(job.network).factoryContractId,
      );

      if (!contractId) {
        const error = new Error('Not a direct configured factory launch');

        error.name = 'InvalidStellarTransaction';

        throw error;
      }

      const launch = await recordStellarLaunch(server, job.network, contractId, transaction);

      return { blockNumber: transaction.ledger, launchContracts: [launch.contractId] };
    }

    try {
      trade = decodeTradeTransaction(transaction, identity);
    } catch {
      trade = null;
    }

    if (!trade) {
      const error = new Error('Not a direct launch buy or sell');

      error.name = 'InvalidStellarTransaction';

      throw error;
    }
  }

  if (!trade) {
    throw new Error('Trade evidence missing');
  }

  const verified = trade;

  const launch = await Launch.findOne({
    ...identity,
    factoryContractId: getNetworkConfig(job.network).factoryContractId,
  }).lean();

  if (!launch) {
    throw new Error('Launch is not indexed yet');
  }

  await mongoose.connection.transaction(async (session): Promise<void> => {
    await LaunchTrade.updateOne(
      { ...identity, transactionHash: job.transactionHash, operationIndex: 0 },
      { $setOnInsert: verified },
      { upsert: true, session },
    );

    await refreshStellarMarket(identity, verified.ledger, session);

    await refreshStellarHoldings(identity, session);

    await LaunchTrade.updateOne(
      { ...identity, transactionHash: job.transactionHash, operationIndex: 0 },
      { $set: { priceRecordedAt: new Date() } },
      { session },
    );
  });

  return {
    blockNumber: verified.ledger,
    trade: toTradeResult(verified, launch.asset),
    pair: launch.pair,
    amountScale: 7,
    priceScale: 7,
  };
};

export default processStellarTransaction;
