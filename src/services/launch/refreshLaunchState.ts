import recordLaunchPrice from './recordLaunchPrice';
import type { LaunchStore } from '../../types/launch/store';
import type { LaunchReader } from '../../types/launch/reader';
import LaunchPriceSample from '../../models/LaunchPriceSample';
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

      const existingPrice =
        seconds >= BigInt(target.startsAt)
          ? await LaunchPriceSample.exists({
              network: reader.network,
              contractId: target.contractId,
            })
          : true;

      // Seed once after opening; subsequent price reads are triggered by verified trades.
      if (!existingPrice) {
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
