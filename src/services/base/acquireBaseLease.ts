import { randomUUID } from 'node:crypto';

import BaseCursor from '../../models/BaseCursor';
import type { BaseWriteContext } from '../../types/base/launch';
import type { BaseContext } from '../../types/base/configuration';

const acquireBaseLease = async (context: BaseContext): Promise<BaseWriteContext | null> => {
  const { configuration } = context;
  const key = { network: configuration.network, factoryAddress: configuration.factoryAddress };

  try {
    await BaseCursor.updateOne(
      key,
      {
        $setOnInsert: { nextBlock: configuration.deploymentBlock.toString() },
      },
      { upsert: true },
    );
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) {
      throw error;
    }
  }

  const leaseOwner = randomUUID();

  const cursor = await BaseCursor.findOneAndUpdate(
    { ...key, $or: [{ leaseUntil: null }, { leaseUntil: { $lte: new Date() } }] },
    { $set: { leaseOwner, leaseUntil: new Date(Date.now() + 300_000) } },
    { returnDocument: 'after' },
  ).lean();

  return cursor ? { ...context, leaseOwner } : null;
};

export default acquireBaseLease;
