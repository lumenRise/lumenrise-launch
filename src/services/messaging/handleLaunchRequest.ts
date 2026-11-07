import getStatsChart from '../stats/getStatsChart';
import getMarketStats from '../stats/getMarketStats';
import getProjectVolume from '../stats/getProjectVolume';
import type { DomainRequest } from '../../types/messaging/domain';
import networkActivityEvents from '../launch/networkActivityEvents';
import parseStatsChartQuery from '../../utils/stats/parseStatsChartQuery';

const handleLaunchRequest = async (request: DomainRequest): Promise<unknown> => {
  const { operation, parameters } = request;

  if (operation === 'testnet.activity') {
    if (
      (parameters.chain !== 'stellar' && parameters.chain !== 'base') ||
      parameters.network !== 'testnet'
    ) {
      throw new Error('Invalid testnet activity identity');
    }

    networkActivityEvents.emit(parameters.chain);

    return { status: 'accepted' };
  }

  const now = typeof parameters.now === 'string' ? new Date(parameters.now) : null;

  if (!now || !Number.isFinite(now.getTime())) {
    throw new Error('Invalid launch observation time');
  }

  if (operation === 'stats.market') {
    if (!Number.isSafeInteger(parameters.userCount) || Number(parameters.userCount) < 0) {
      throw new Error('Invalid user count');
    }

    return getMarketStats(now, Number(parameters.userCount));
  }

  if (operation === 'stats.volume') {
    const network = parameters.network;

    if (network !== 'testnet' && network !== 'public' && network !== 'all') {
      throw new Error('Invalid statistics network');
    }

    return getProjectVolume(network, now);
  }

  if (operation === 'stats.chart') {
    const query = parameters.query;

    if (!query || typeof query !== 'object' || Array.isArray(query)) {
      throw new Error('Invalid statistics query');
    }

    const parsed = parseStatsChartQuery(query as Record<string, unknown>, now);

    if (!parsed) {
      throw new Error('Invalid statistics query');
    }

    return getStatsChart(parsed, now);
  }

  throw new Error('Unknown launch operation');
};

export default handleLaunchRequest;
