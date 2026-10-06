import parseLaunchState from './chain/parseLaunchState';
import type { LaunchReader, LaunchStore } from './types';

const refreshLaunchState = async (reader: LaunchReader, store: LaunchStore): Promise<void> => {
  const { value: count } = await reader.launchCount();

  if (count === 0) {
    return;
  }

  const index = await store.nextStateIndex();

  if (!Number.isInteger(index) || index < 1) {
    throw new Error('Factory state cursor is invalid');
  }

  const current = index > count ? 1 : index;
  const { value: contractId } = await reader.launchAt(current);

  if (!contractId) {
    throw new Error(`Factory launch ${current} is missing`);
  }

  const { value, ledger } = await reader.launchState(contractId);

  await store.refreshState(current, parseLaunchState(value), ledger);
  await store.advanceState(current === count ? 1 : current + 1);
};

export default refreshLaunchState;
