import Launch from '../../models/Launch';
import claimLaunchName from './claimLaunchName';
import FactoryCursor from '../../models/FactoryCursor';
import resolveLaunchMetadata from './resolveLaunchMetadata';
import type { LaunchStore } from '../../types/launch/store';
import type { Configuration } from '../../types/configuration';
import type { ClaimedStateTarget } from '../../types/launch/store';

const createLaunchStore = (configuration: Configuration): LaunchStore => {
  const identity = {
    chain: 'stellar' as const,
    network: configuration.network,
    factoryContractId: configuration.factoryContractId,
  };

  return {
    nextIndex: async () => {
      const cursor = await FactoryCursor.findOne(identity).lean();

      return cursor?.nextIndex ?? 1;
    },

    indexedIndexes: async (count: number): Promise<number[]> =>
      Launch.distinct('factoryIndex', {
        ...identity,
        factoryIndex: { $gte: 1, $lte: count },
      }),

    save: async (launch) => {
      const { createdAt, creationLedger, creationTransactionHash, ...data } = launch;
      const slug = await claimLaunchName(launch);
      const metadata = await resolveLaunchMetadata(launch);

      await Launch.updateOne(
        {
          ...identity,
          factoryIndex: launch.factoryIndex,
          contractId: launch.contractId,
        },
        {
          $setOnInsert: { ...data, slug, metadata, nextStatePollAt: new Date(0) },
          ...(createdAt ? { $set: { createdAt, creationLedger, creationTransactionHash } } : {}),
        },
        { upsert: true },
      );
    },

    advance: async (nextIndex) => {
      await FactoryCursor.updateOne(
        identity,
        { $max: { nextIndex }, $setOnInsert: identity },
        { upsert: true },
      );
    },

    dueStateTargets: async (now, limit) => {
      const targets: ClaimedStateTarget[] = [];

      for (let position = 0; position < limit; position += 1) {
        const claimedUntil = new Date(Date.now() + 120_000);

        const launch = await Launch.findOneAndUpdate(
          {
            ...identity,
            $or: [{ nextStatePollAt: { $lte: now } }, { nextStatePollAt: { $exists: false } }],
          },
          { $set: { nextStatePollAt: claimedUntil } },
          { sort: { nextStatePollAt: 1, factoryIndex: 1 }, returnDocument: 'after' },
        )
          .select(
            'factoryIndex contractId config.params.starts_at config.params.ends_at state.graduated state.sold',
          )
          .lean();

        if (!launch) {
          break;
        }

        const params = (launch.config as { params?: Record<string, unknown> }).params;

        if (
          typeof params?.starts_at !== 'string' ||
          (params.ends_at !== undefined && typeof params.ends_at !== 'string')
        ) {
          throw new Error(`Launch ${launch.factoryIndex} has invalid schedule`);
        }

        targets.push({
          factoryIndex: launch.factoryIndex,
          contractId: launch.contractId,
          startsAt: params.starts_at,
          endsAt: typeof params.ends_at === 'string' ? params.ends_at : null,
          graduated: launch.state.graduated === true,
          sold: String(launch.state.sold),
          claimedUntil,
        });
      }

      return targets;
    },

    refreshState: async (index, state, ledger, nextPollAt, claimedUntil) => {
      const result = await Launch.updateOne(
        {
          ...identity,
          factoryIndex: index,
          stateAsOfLedger: { $lte: ledger },
          nextStatePollAt: claimedUntil,
        },
        {
          $set: {
            state,
            stateAsOfLedger: ledger,
            stateObservedAt: new Date(),
            nextStatePollAt: nextPollAt,
          },
        },
      );

      if (result.matchedCount === 1) {
        return true;
      }

      const newer = await Launch.exists({
        ...identity,
        factoryIndex: index,
        $or: [{ stateAsOfLedger: { $gt: ledger } }, { nextStatePollAt: { $ne: claimedUntil } }],
      });

      if (!newer) {
        throw new Error(`Launch ${index} is not indexed`);
      }

      return false;
    },

    deferStateTarget: async (index, nextPollAt, claimedUntil) => {
      await Launch.updateOne(
        {
          ...identity,
          factoryIndex: index,
          nextStatePollAt: claimedUntil,
        },
        { $set: { nextStatePollAt: nextPollAt } },
      );
    },
  };
};

export default createLaunchStore;
