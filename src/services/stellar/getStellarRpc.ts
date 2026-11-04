import { rpc } from '@stellar/stellar-sdk';

import getNetworkConfig from '../network/getNetworkConfig';
import type { Configuration } from '../../types/configuration';
import type { StellarNetwork } from '../../types/network/configuration';

const connections = new Map<string, rpc.Server>();

const getStellarRpc = (network: StellarNetwork, configured?: Configuration): rpc.Server => {
  const configuration = configured ?? getNetworkConfig(network);
  const key = `${network}:${configuration.rpcUrl}`;
  const existing = connections.get(key);

  if (existing) {
    return existing;
  }

  const server = new rpc.Server(configuration.rpcUrl, {
    allowHttp: configuration.rpcUrl.startsWith('http:'),
    timeout: 15_000,
  });

  connections.set(key, server);

  return server;
};

export default getStellarRpc;
