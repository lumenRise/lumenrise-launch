import LaunchHolder from '../../models/LaunchHolder';
import type { HolderBalanceReader } from '../../types/launch/holder';
import parseTradeInteger from '../../utils/launch/parseTradeInteger';

const refreshLaunchHolder = async (
  reader: HolderBalanceReader,
  identity: { network: 'testnet' | 'public'; contractId: string },
  asset: string,
  address: string,
): Promise<void> => {
  const balance = parseTradeInteger(await reader.tokenBalance(asset, address));

  if (balance < 0n || balance.toString().length > 39) {
    throw new Error('Invalid token balance');
  }

  const key = { ...identity, address };

  if (balance === 0n) {
    await LaunchHolder.deleteOne(key);
    return;
  }

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
};

export default refreshLaunchHolder;
