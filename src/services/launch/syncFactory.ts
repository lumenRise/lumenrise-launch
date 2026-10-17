import log from '../../logger';
import type { LaunchStore } from '../../types/launch/store';
import type { LaunchReader } from '../../types/launch/reader';
import type { Configuration } from '../../types/configuration';
import parseLaunchConfig from '../../utils/launch/parseLaunchConfig';

const syncFactory = async (
  reader: LaunchReader,
  store: LaunchStore,
  configuration: Configuration,
  reconcile: boolean = false,
): Promise<number> => {
  const { value: count } = await reader.launchCount();

  let index = await store.nextIndex();

  if (!Number.isInteger(index) || index < 1 || index > count + 1) {
    throw new Error('Factory cursor is inconsistent with the on-chain launch count');
  }

  const indexedIndexes = reconcile ? new Set(await store.indexedIndexes(count)) : null;
  let added = 0;

  if (reconcile) {
    index = 1;
  }

  while (index <= count) {
    if (indexedIndexes?.has(index)) {
      index += 1;

      continue;
    }

    const { value: contractId } = await reader.launchAt(index);

    if (!contractId) {
      throw new Error(`Factory launch ${index} is missing`);
    }

    const config = await reader.launchConfig(contractId);
    const state = await reader.launchState(contractId);

    const launch = parseLaunchConfig({
      rawConfig: config.value,
      rawState: state.value,
      network: configuration.network,
      factoryContractId: configuration.factoryContractId,
      factoryIndex: index,
      contractId,
      asOfLedger: config.ledger,
      stateAsOfLedger: state.ledger,
    });

    await store.save(launch);
    await store.advance(index + 1);

    log.info(
      {
        network: launch.network,
        factoryContractId: launch.factoryContractId,
        factoryIndex: launch.factoryIndex,
        contractId: launch.contractId,
        name: launch.metadata.name,
        symbol: launch.metadata.symbol,
        asset: launch.asset,
        owner: launch.owner,
      },
      'New launch indexed',
    );

    index += 1;
    added += 1;
  }

  if (reconcile) {
    await store.advance(count + 1);

    log.info(
      {
        network: configuration.network,
        factoryContractId: configuration.factoryContractId,
        launchCount: count,
        indexedCount: indexedIndexes?.size ?? 0,
        recoveredCount: added,
      },
      'Launch factory reconciliation completed',
    );
  }

  return added;
};

export default syncFactory;
