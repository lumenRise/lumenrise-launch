import type { LaunchData } from './types/launch';
import type { CurvePriceParams } from './types/market';
import LaunchPriceSample from './store/LaunchPriceSample';

const recordLaunchPrice = async (launch: LaunchData): Promise<void> => {
  const params = launch.config.params as CurvePriceParams;
  const curve = params?.curve;

  if (!curve || typeof launch.state.sold !== 'string') {
    return;
  }

  const base = BigInt(String(curve.virtual_base_reserve));
  const quote = BigInt(String(curve.virtual_quote_reserve));
  const sold = BigInt(launch.state.sold);
  const remaining = base - sold;

  if (remaining <= 0n || quote <= 0n || sold < 0n) {
    throw new Error('Invalid curve reserves for price sample');
  }

  const denominator = remaining * remaining;
  const price = (quote * base * 10_000_000n + denominator - 1n) / denominator;
  const bucket = new Date(
    Math.floor(launch.stateObservedAt.getTime() / 60_000) * 60_000,
  );

  try {
    await LaunchPriceSample.updateOne(
      {
        network: launch.network,
        contractId: launch.contractId,
        bucket,
        ledger: { $lte: launch.stateAsOfLedger },
      },
      {
        $set: {
          sampledAt: launch.stateObservedAt,
          ledger: launch.stateAsOfLedger,
          price: price.toString(),
          priceSort: price.toString().padStart(39, '0'),
        },
      },
      { upsert: true },
    );
  } catch (error) {
    // A newer sample won the same unique minute bucket. Do not roll it back.
    if (!(
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 11000
    )) {
      throw error;
    }
  }
};

export default recordLaunchPrice;
