import nextStatePollAt from './nextStatePollAt';
import parseLaunchState from './chain/parseLaunchState';
import type { LaunchReader, LaunchStore } from './types/launch';

const refreshLaunchState = async (
  reader: LaunchReader,
  store: LaunchStore,
  now = new Date(),
  onError?: (error: unknown, contractId: string) => void,
): Promise<number> => {
  const targets = await store.dueStateTargets(now, 2);
  let refreshed = 0;

  for (const target of targets) {
    try {
      const { value, ledger } = await reader.launchState(target.contractId);
      const state = parseLaunchState(value);

      await store.refreshState(
        target.factoryIndex,
        state,
        ledger,
        nextStatePollAt(target, state.graduated === true, now),
      );

      refreshed += 1;
    } catch (error) {
      onError?.(error, target.contractId);
      try {
        await store.deferStateTarget(
          target.factoryIndex,
          new Date(now.getTime() + 30_000),
        );
      } catch (deferError) {
        onError?.(deferError, target.contractId);
      }
    }
  }

  return refreshed;
};

export default refreshLaunchState;
