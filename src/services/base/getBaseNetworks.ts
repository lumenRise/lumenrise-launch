import getBaseConfiguration from './getBaseConfiguration';
import type { BaseConfiguration } from '../../types/base/configuration';

const getBaseNetworks = (): BaseConfiguration['network'][] =>
  (
    [
      'testnet',
      // 'public',
    ] as const
  ).filter((network): boolean => getBaseConfiguration(network) !== null);

export default getBaseNetworks;
