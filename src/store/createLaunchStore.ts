import Launch from './Launch';
import FactoryCursor from './FactoryCursor';
import type { LaunchStore } from '../types/launch';
import type { Configuration } from '../types/configuration';

const createLaunchStore = (configuration: Configuration): LaunchStore => {
  const identity = {
    network: configuration.network,
    factoryContractId: configuration.factoryContractId,
  };

  return {
    nextIndex: async () => {
      const cursor = await FactoryCursor.findOne(identity).lean();

      return cursor?.nextIndex ?? 1;
    },

    save: async (launch) => {
      await Launch.updateOne(
        {
          ...identity,
          factoryIndex: launch.factoryIndex,
          contractId: launch.contractId,
        },
        { $setOnInsert: { ...launch, nextStatePollAt: new Date(0) } },
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
      const launches = await Launch.find({
        ...identity,
        $or: [
          { nextStatePollAt: { $lte: now } },
          { nextStatePollAt: { $exists: false } },
        ],
      })
        .sort({ nextStatePollAt: 1, factoryIndex: 1 })
        .limit(limit)
        .select('factoryIndex contractId config.params.starts_at config.params.ends_at state.graduated')
        .lean();

      return launches.map((launch) => {
        const params = (launch.config as { params?: Record<string, unknown> }).params;
        if (typeof params?.starts_at !== 'string' || typeof params.ends_at !== 'string') {
          throw new Error(`Launch ${launch.factoryIndex} has invalid schedule`);
        }
        return {
          factoryIndex: launch.factoryIndex,
          contractId: launch.contractId,
          startsAt: params.starts_at,
          endsAt: params.ends_at,
          graduated: launch.state.graduated === true,
        };
      });
    },

    refreshState: async (index, state, ledger, nextPollAt) => {
      const result = await Launch.updateOne(
        { ...identity, factoryIndex: index, stateAsOfLedger: { $lte: ledger } },
        {
          $set: { state, stateAsOfLedger: ledger, stateObservedAt: new Date(), nextStatePollAt: nextPollAt },
        },
      );

      if (result.matchedCount !== 1) {
        const newer = await Launch.exists({ ...identity, factoryIndex: index, stateAsOfLedger: { $gt: ledger } });
        if (!newer) { throw new Error(`Launch ${index} is not indexed`); }
        await Launch.updateOne(
          { ...identity, factoryIndex: index, stateAsOfLedger: { $gt: ledger } },
          { $set: { nextStatePollAt: nextPollAt } },
        );
      }
    },

    deferStateTarget: async (index, nextPollAt) => {
      await Launch.updateOne({ ...identity, factoryIndex: index }, { $set: { nextStatePollAt: nextPollAt } });
    },
  };
};

export default createLaunchStore;
