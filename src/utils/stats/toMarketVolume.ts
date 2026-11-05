import { formatUnits } from 'viem';

import type { MarketAccumulator } from '../../types/stats/market';
import type { ProjectVolumeBucket } from '../../types/stats/volume';

const toMarketVolume = (value: MarketAccumulator): ProjectVolumeBucket => ({
  amount: formatUnits(value.amount * 2n, 18),
  tradeCount: value.tradeCount,
  buyCount: value.buyCount,
  sellCount: value.tradeCount - value.buyCount,
});

export default toMarketVolume;
