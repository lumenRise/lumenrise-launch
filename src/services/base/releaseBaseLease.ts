import BaseCursor from '../../models/BaseCursor';
import type { BaseWriteContext } from '../../types/base/launch';

const releaseBaseLease = async (context: BaseWriteContext): Promise<void> => {
  await BaseCursor.updateOne(
    {
      network: context.configuration.network,
      factoryAddress: context.configuration.factoryAddress,
      leaseOwner: context.leaseOwner,
    },
    { $set: { leaseOwner: null, leaseUntil: null } },
  );
};

export default releaseBaseLease;
