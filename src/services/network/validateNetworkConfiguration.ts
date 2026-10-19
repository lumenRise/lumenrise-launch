import { StrKey } from '@stellar/stellar-sdk';

import type { NetworkConfiguration } from '../../types/network/configuration';

const validateNetworkConfiguration = (configuration: Readonly<NetworkConfiguration>): void => {
  const { network, horizonUrl, rpcUrl, factoryContractId } = configuration;

  for (const value of [horizonUrl, rpcUrl]) {
    if (!value) {
      continue;
    }

    const url = new URL(value);

    if (
      (url.protocol !== 'https:' && !(network === 'testnet' && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    ) {
      throw new Error(`Invalid ${network} provider URL`);
    }

    if (
      url.hostname.endsWith('.stellar.org') &&
      url.hostname.includes('testnet') !== (network === 'testnet')
    ) {
      throw new Error(`Provider URL does not match ${network}`);
    }
  }

  if (!horizonUrl) {
    throw new Error(`Horizon URL is required for ${network}`);
  }

  if (
    factoryContractId &&
    (!rpcUrl || !StrKey.isValidContract(factoryContractId))
  ) {
    throw new Error(`Factory and RPC must be configured together for ${network}`);
  }
};

export default validateNetworkConfiguration;
