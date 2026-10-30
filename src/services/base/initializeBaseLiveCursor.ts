import getBaseContext from './getBaseContext';
import BaseCursor from '../../models/BaseCursor';
import acquireBaseLease from './acquireBaseLease';
import releaseBaseLease from './releaseBaseLease';
import type { BaseConfiguration } from '../../types/base/configuration';

const initializeBaseLiveCursor = async (
  network: BaseConfiguration['network'],
): Promise<boolean> => {
  const context = await getBaseContext(network);
  const head = await context.client.getBlockNumber();
  const writer = await acquireBaseLease(context);

  if (!writer) {
    return false;
  }

  try {
    const start =
      head < context.configuration.deploymentBlock ? context.configuration.deploymentBlock : head;

    const updated = await BaseCursor.updateOne(
      {
        network,
        factoryAddress: context.configuration.factoryAddress,
        leaseOwner: writer.leaseOwner,
      },
      { $set: { nextLiveBlock: start.toString(), historyEndBlock: (start - 1n).toString() } },
    );

    if (updated.matchedCount !== 1) {
      throw new Error('Base live initialization lease expired');
    }

    return true;
  } finally {
    await releaseBaseLease(writer);
  }
};

export default initializeBaseLiveCursor;
