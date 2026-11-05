import Launch from '../../models/Launch';
import refreshBaseMarket from './refreshBaseMarket';
import LaunchPriceSample from '../../models/LaunchPriceSample';
import type { BaseEventContext } from '../../types/base/launch';

const refreshBaseMarketIfNeeded = async (
  context: BaseEventContext,
  contractId: string,
  blockNumber: bigint,
  timestamp: bigint,
  traders: string[],
): Promise<void> => {
  const identity = { chain: 'base' as const, network: context.configuration.network, contractId };
  const launch = await Launch.findOne(identity).session(context.session).lean();

  if (
    launch?.stateAsOfLedger === Number(blockNumber) &&
    (await LaunchPriceSample.exists({
      ...identity,
      observationKey: blockNumber.toString(),
    }).session(context.session))
  ) {
    return;
  }

  await refreshBaseMarket(context, contractId, blockNumber, timestamp, traders);
};

export default refreshBaseMarketIfNeeded;
