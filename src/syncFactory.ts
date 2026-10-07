import parseLaunchConfig from './chain/parseLaunchConfig';
import type { Configuration } from './types/configuration';
import type { LaunchReader, LaunchStore } from './types/launch';

const syncFactory = async (
  reader: LaunchReader,
  store: LaunchStore,
  configuration: Configuration,
): Promise<number> => {
  const { value: count } = await reader.launchCount();
  let index = await store.nextIndex();

  if (!Number.isInteger(index) || index < 1 || index > count + 1) {
    throw new Error('Factory cursor is inconsistent with the on-chain launch count');
  }

  let added = 0;

  while (index <= count) {
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

    index += 1;
    added += 1;
  }

  return added;
};

export default syncFactory;
