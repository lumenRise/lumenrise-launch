import log from '../../logger';
import LaunchHolder from '../../models/LaunchHolder';
import type { HolderBalanceReader } from '../../types/launch/holder';
import parseTradeInteger from '../../utils/launch/parseTradeInteger';

const refreshLaunchHolder = async (
  reader: HolderBalanceReader,
  identity: { chain?: 'stellar' | 'base'; network: 'testnet' | 'public'; contractId: string },
  asset: string,
  address: string,
): Promise<void> => {
  const balance = parseTradeInteger(await reader.tokenBalance(asset, address));

  if (balance < 0n || balance.toString().length > 39) {
    throw new Error('Invalid token balance');
  }

  const key = { ...identity, chain: 'stellar' as const, address };

  if (balance === 0n) {
    const removed = await LaunchHolder.deleteOne(key);

    if (removed?.deletedCount === 1) {
      log.info(key, 'Stellar holder removed');
    }

    return;
  }

  const previous = await LaunchHolder.findOne(key).lean();

  const update = {
    $set: {
      asset,
      balance: balance.toString(),
      balanceSort: balance.toString().padStart(39, '0'),
      observedAt: new Date(),
    },
  };

  try {
    await LaunchHolder.updateOne(key, update, { upsert: true, runValidators: true });
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 11000) {
      throw error;
    }

    await LaunchHolder.updateOne(key, update, { upsert: true, runValidators: true });
  }

  if (!previous || previous.balance !== balance.toString()) {
    log.info({ ...key, balance: balance.toString() }, 'Stellar holder balance changed');
  }
};

export default refreshLaunchHolder;
