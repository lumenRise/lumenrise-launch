import recordLaunchPrice from './recordLaunchPrice';
import type { LaunchStore } from '../../types/launch/store';
import type { LaunchReader } from '../../types/launch/reader';
import nextStatePollAt from '../../utils/launch/nextStatePollAt';
import parseLaunchState from '../../utils/launch/parseLaunchState';

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

      const seconds = BigInt(Math.floor(now.getTime() / 1000));

      const alreadyStopped =
        target.graduated || (seconds >= BigInt(target.endsAt) && target.sold === '0');

      const stoppedNow =
        state.graduated === true || (seconds >= BigInt(target.endsAt) && state.sold === '0');

      if (seconds >= BigInt(target.startsAt) && (!alreadyStopped || !stoppedNow)) {
        const priceRead = await reader.launchPrice(target.contractId);

        if (priceRead.ledger < ledger) {
          throw new Error('RPC price observation is behind the state');
        }

        await recordLaunchPrice(
          { network: reader.network, contractId: target.contractId },
          priceRead,
        );
      }

      await store.refreshState(
        target.factoryIndex,
        state,
        ledger,
        nextStatePollAt(target, state.graduated === true, now, String(state.sold)),
      );

      refreshed += 1;
    } catch (error) {
      onError?.(error, target.contractId);
      try {
        await store.deferStateTarget(target.factoryIndex, new Date(now.getTime() + 30_000));
      } catch (deferError) {
        onError?.(deferError, target.contractId);
      }
    }
  }

  return refreshed;
};

export default refreshLaunchState;
