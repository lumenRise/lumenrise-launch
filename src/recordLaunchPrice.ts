import type { ChainRead } from './types/launch';
import LaunchPriceSample from './store/LaunchPriceSample';
import parseTradeInteger from './chain/parseTradeInteger';

const recordLaunchPrice = async (
  identity: { network: 'testnet' | 'public'; contractId: string },
  read: ChainRead<unknown>,
  sampledAt = new Date(),
): Promise<void> => {
  const price = parseTradeInteger(read.value);

  if (price <= 0n) {
    throw new Error('Invalid contract price');
  }
  // Preserve each observation, including several trades within one minute.
  await LaunchPriceSample.updateOne(
    { ...identity, bucket: sampledAt },
    {
      $setOnInsert: {
        sampledAt,
        ledger: read.ledger,
        price: price.toString(),
        priceSort: price.toString().padStart(39, '0'),
      },
    },
    { upsert: true },
  );
};

export default recordLaunchPrice;
