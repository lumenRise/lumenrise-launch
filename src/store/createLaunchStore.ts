import Launch from './Launch';
import type { LaunchStore } from '../types';
import FactoryCursor from './FactoryCursor';
import type { Configuration } from '../configuration';

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
        { ...identity, factoryIndex: launch.factoryIndex, contractId: launch.contractId },
        { $setOnInsert: launch },
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

    nextStateIndex: async () => {
      const cursor = await FactoryCursor.findOne(identity).lean();

      return cursor?.nextStateIndex ?? 1;
    },

    refreshState: async (index, state, ledger) => {
      const result = await Launch.updateOne(
        { ...identity, factoryIndex: index },
        { $set: { state, stateAsOfLedger: ledger, stateObservedAt: new Date() } },
      );

      if (result.matchedCount !== 1) {
        throw new Error(`Launch ${index} is not indexed`);
      }
    },

    advanceState: async (nextStateIndex) => {
      const result = await FactoryCursor.updateOne(identity, { $set: { nextStateIndex } });

      if (result.matchedCount !== 1) {
        throw new Error('Factory cursor is missing');
      }
    },
  };
};

export default createLaunchStore;
