import BaseCursor from '../../models/BaseCursor';
import acquireBaseLease from './acquireBaseLease';
import releaseBaseLease from './releaseBaseLease';
import processBaseBlock from './processBaseBlock';
import reconcileBaseChain from './reconcileBaseChain';
import type { BaseBlockInput } from '../../types/base/launch';
import type { BaseContext } from '../../types/base/configuration';
import recoverUnknownBaseLaunches from './recoverUnknownBaseLaunches';

const commitBaseScanBlock = async (
  context: BaseContext,
  input: Omit<BaseBlockInput, 'context'>,
): Promise<boolean> => {
  const writer = await acquireBaseLease(context);

  if (!writer) {
    return false;
  }

  try {
    if (await reconcileBaseChain(writer)) {
      return false;
    }

    const cursor = await BaseCursor.findOne({
      network: context.configuration.network,
      factoryAddress: context.configuration.factoryAddress,
    }).lean();
    const next = input.mode === 'live' ? cursor?.nextLiveBlock : cursor?.nextBlock;

    if (next !== input.expectedNextBlock) {
      return false;
    }

    const logs =
      input.mode === 'live' ? await recoverUnknownBaseLaunches(writer, input.logs) : input.logs;

    await processBaseBlock({ ...input, logs, context: writer });

    return true;
  } finally {
    await releaseBaseLease(writer);
  }
};

export default commitBaseScanBlock;
