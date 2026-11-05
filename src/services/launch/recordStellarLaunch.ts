import type { rpc } from '@stellar/stellar-sdk';
import { nativeToScVal } from '@stellar/stellar-sdk';

import log from '../../logger';
import Launch from '../../models/Launch';
import claimLaunchName from './claimLaunchName';
import getNetworkConfig from '../network/getNetworkConfig';
import type { LaunchData } from '../../types/launch/model';
import resolveLaunchMetadata from './resolveLaunchMetadata';
import readLaunchContract from '../stellar/readLaunchContract';
import parseLaunchConfig from '../../utils/launch/parseLaunchConfig';
import type { StellarNetwork } from '../../types/network/configuration';
import deriveStellarLaunchAddress from '../../utils/launch/deriveStellarLaunchAddress';

const recordStellarLaunch = async (
  server: rpc.Server,
  network: StellarNetwork,
  contractId: string,
  transaction: rpc.Api.GetSuccessfulTransactionResponse,
): Promise<LaunchData> => {
  const configuration = getNetworkConfig(network);
  const factory = configuration.factoryContractId;
  const identity = { chain: 'stellar' as const, network, contractId };
  const existing = await Launch.findOne(identity).lean();

  if (existing?.creationTransactionHash === transaction.txHash) {
    return existing;
  }

  const count = await readLaunchContract(server, factory, 'launch_count', network);

  if (
    typeof count.value !== 'number' ||
    !Number.isSafeInteger(count.value) ||
    count.value < 1 ||
    count.value > 0xffffffff
  ) {
    throw new Error('Factory returned an invalid launch count');
  }

  let index = existing?.factoryIndex ?? count.value;

  if (!existing) {
    while (
      index > 0 &&
      deriveStellarLaunchAddress(factory, index, configuration.networkPassphrase) !== contractId
    ) {
      index -= 1;
    }
  }

  if (index < 1) {
    throw new Error('Launch is not derived from the configured factory');
  }

  const registered = await readLaunchContract(server, factory, 'launch_at', network, [
    nativeToScVal(index, { type: 'u32' }),
  ]);

  if (registered.value !== contractId) {
    throw new Error('Launch is not registered by the configured factory');
  }

  const config = await readLaunchContract(server, contractId, 'get_config', network);
  const state = await readLaunchContract(server, contractId, 'get_state', network);

  if (config.ledger < transaction.ledger || state.ledger < transaction.ledger) {
    throw new Error('RPC observation is behind the launch transaction');
  }

  const launch = parseLaunchConfig({
    rawConfig: config.value,
    rawState: state.value,
    network,
    factoryContractId: factory,
    factoryIndex: index,
    contractId,
    asOfLedger: config.ledger,
    stateAsOfLedger: state.ledger,
  });

  const slug = await claimLaunchName(launch);
  const metadata = await resolveLaunchMetadata(launch);

  try {
    const result = await Launch.updateOne(
      identity,
      {
        $setOnInsert: {
          ...launch,
          slug,
          metadata,
          holderSource: 'recorded_trades',
          nextStatePollAt: new Date(0),
        },
        $set: {
          createdAt: new Date(transaction.createdAt * 1000),
          creationLedger: transaction.ledger,
          creationTransactionHash: transaction.txHash,
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount === 1) {
      log.info(
        { ...identity, factoryIndex: index, transactionHash: transaction.txHash },
        'Stellar new launch indexed from confirmation',
      );
    }
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 11000 ||
      !(await Launch.exists({ ...identity, factoryContractId: factory, factoryIndex: index }))
    ) {
      throw error;
    }
  }

  const saved = await Launch.findOne(identity).lean();

  if (!saved) {
    throw new Error('Confirmed launch is not indexed');
  }

  return saved;
};

export default recordStellarLaunch;
