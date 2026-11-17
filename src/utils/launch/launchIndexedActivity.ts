import type { LaunchData } from '../../types/launch/model';

const launchIndexedActivity = (launch: LaunchData): Record<string, unknown> => ({
  event: 'launch.indexed',
  chain: launch.chain ?? 'stellar',
  network: launch.network,
  factoryContractId: launch.factoryContractId,
  factoryIndex: launch.factoryIndex,
  contractId: launch.contractId,
  name: launch.metadata.name,
  symbol: launch.metadata.symbol,
  logo: launch.metadata.logo,
  asset: launch.asset,
  pair: launch.pair,
  owner: launch.owner,
  createdAt: launch.createdAt ?? null,
  ledger: launch.creationLedger ?? null,
  transactionHash: launch.creationTransactionHash ?? null,
});

export default launchIndexedActivity;
