import type { Block } from 'viem';

import type { BaseContext } from '../../types/base/configuration';

const observations = new Map<string, { at: number; block: Promise<Block> }>();

const readBaseFinalized = async (context: BaseContext): Promise<Block> => {
  const key = context.configuration.rpcUrl;
  const existing = observations.get(key);

  if (existing && Date.now() - existing.at < 60_000) {
    return existing.block;
  }

  const observation = { at: Date.now(), block: context.client.getBlock({ blockTag: 'finalized' }) };

  observations.set(key, observation);

  try {
    return await observation.block;
  } catch (error) {
    if (observations.get(key) === observation) {
      observations.delete(key);
    }

    throw error;
  }
};

export default readBaseFinalized;
