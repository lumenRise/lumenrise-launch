import log from '../../logger';
import LaunchPriceSample from '../../models/LaunchPriceSample';
import parseTradeInteger from '../../utils/launch/parseTradeInteger';

const recordLaunchPrice = async (
  identity: { chain?: 'stellar' | 'base'; network: 'testnet' | 'public'; contractId: string },
  read: { value: unknown; ledger: number },
  sampledAt = new Date(),
): Promise<void> => {
  identity = { ...identity, chain: 'stellar' as const };

  const price = parseTradeInteger(read.value);

  if (
    price <= 0n ||
    price.toString().length > 39 ||
    !Number.isSafeInteger(read.ledger) ||
    read.ledger < 1
  ) {
    throw new Error('Invalid contract price observation');
  }

  const previous = await LaunchPriceSample.findOne(identity)
    .sort({ ledger: -1, sampledAt: -1 })
    .lean();

  if (previous && (previous.ledger >= read.ledger || previous.price === price.toString())) {
    return;
  }

  const observationKey = String(read.ledger);

  try {
    const result = await LaunchPriceSample.updateOne(
      { ...identity, observationKey },
      {
        $setOnInsert: {
          bucket: sampledAt,
          sampledAt,
          ledger: read.ledger,
          price: price.toString(),
          priceSort: price.toString().padStart(39, '0'),
        },
      },
      { upsert: true },
    );

    if (result?.upsertedCount === 1) {
      log.info(
        {
          ...identity,
          ledger: read.ledger,
          price: price.toString(),
          previousPrice: previous?.price ?? null,
          priceScale: 7,
          sampledAt,
        },
        'Stellar launch price observation recorded',
      );
    }
  } catch (error) {
    if (
      !error ||
      typeof error !== 'object' ||
      !('code' in error) ||
      error.code !== 11000 ||
      !(await LaunchPriceSample.exists({ ...identity, observationKey }))
    ) {
      throw error;
    }
  }
};

export default recordLaunchPrice;
