import log from '../../logger';
import recordLaunchPrice from './recordLaunchPrice';
import type { LaunchStore } from '../../types/launch/store';
import type { LaunchReader } from '../../types/launch/reader';
import nextStatePollAt from '../../utils/launch/nextStatePollAt';
import parseLaunchState from '../../utils/launch/parseLaunchState';

const refreshLaunchState = async (
  reader: LaunchReader,
  store: LaunchStore,
  now: Date = new Date(),
  onError?: (error: unknown, contractId: string) => void,
): Promise<number> => {
  const targets = await store.dueStateTargets(now, 2);
  let refreshed = 0;

  for (const target of targets) {
    try {
      const { value, ledger } = await reader.launchState(target.contractId);
      const state = parseLaunchState(value);
      const seconds = BigInt(Math.floor(Date.now() / 1000));

      if (seconds >= BigInt(target.startsAt)) {
        const priceRead = await reader.launchPrice(target.contractId);

        if (priceRead.ledger < ledger) {
          throw new Error('RPC price observation is behind the state');
        }

        await recordLaunchPrice(
          { chain: 'stellar' as const, network: reader.network, contractId: target.contractId },
          priceRead,
        );
      }

      const nextPollAt = nextStatePollAt(
        target,
        state.graduated === true,
        new Date(),
        String(state.sold),
      );

      const saved = await store.refreshState(
        target.factoryIndex,
        state,
        ledger,
        nextPollAt,
        target.claimedUntil,
      );

      if (!saved) {
        continue;
      }

      const previousState = target.state ?? { sold: target.sold, graduated: target.graduated };
      const changed = Object.keys(previousState).some(
        (key: string): boolean => previousState[key] !== state[key],
      );

      if (changed) {
        log.info(
          {
            chain: 'stellar',
            network: reader.network,
            contractId: target.contractId,
            ledger,
            state,
          },
          'Stellar launch state changed',
        );
      }

      refreshed += 1;
    } catch (error) {
      onError?.(error, target.contractId);

      try {
        await store.deferStateTarget(
          target.factoryIndex,
          new Date(Date.now() + 30_000),
          target.claimedUntil,
        );
      } catch (deferError) {
        onError?.(deferError, target.contractId);
      }
    }
  }

  return refreshed;
};

export default refreshLaunchState;
