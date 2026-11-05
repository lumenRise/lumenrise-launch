import type { LaunchScales } from '../../types/launch/scales';
import type { LaunchData as LaunchRecord } from '../../types/launch/model';

const getLaunchScales = (launch: LaunchRecord): LaunchScales => {
  if (launch.chain !== 'base') {
    return { amountScale: 7, priceScale: 7 };
  }

  const amountScale = launch.assetDecimals;
  const priceScale = launch.pairDecimals;

  if (
    amountScale === undefined ||
    priceScale === undefined ||
    !Number.isInteger(amountScale) ||
    !Number.isInteger(priceScale) ||
    amountScale < 0 ||
    amountScale > 18 ||
    priceScale < 0 ||
    priceScale > 18
  ) {
    throw new Error('Base launch token decimals are missing or invalid; reindex the launch');
  }

  return { amountScale, priceScale };
};

export default getLaunchScales;
