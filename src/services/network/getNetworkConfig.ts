import { resolve } from 'node:path';
import { Networks } from '@stellar/stellar-sdk';

import env from '../../env';
import type { StellarNetwork, NetworkConfiguration } from '../../types/network/configuration';

const getNetworkConfig = (
  network: StellarNetwork,
  configuration: typeof env = env,
): Readonly<NetworkConfiguration> => {
  if (network === 'testnet') {
    return {
      network,
      rpcUrl: configuration.STELLAR_TESTNET_RPC_URL,
      horizonUrl: configuration.STELLAR_TESTNET_HORIZON_URL,
      networkPassphrase: Networks.TESTNET,
      factoryContractId: configuration.LAUNCH_TESTNET_FACTORY_CONTRACT_ID,
      homeDomain: configuration.STELLAR_TESTNET_HOME_DOMAIN,
      tomlPath: resolve(
        configuration.TESTNET_TOML ||
          resolve(
            configuration.STELLAR_TESTNET_TOML_DIRNAME,
            configuration.STELLAR_TESTNET_TOML_FILENAME,
          ),
      ),
    };
  }

  return {
    network,
    rpcUrl: configuration.STELLAR_PUBLIC_RPC_URL,
    horizonUrl: configuration.STELLAR_PUBLIC_HORIZON_URL,
    networkPassphrase: Networks.PUBLIC,
    factoryContractId: configuration.LAUNCH_PUBLIC_FACTORY_CONTRACT_ID,
    homeDomain: configuration.STELLAR_PUBLIC_HOME_DOMAIN,
    tomlPath: resolve(
      configuration.PUBLIC_TOML ||
        resolve(
          configuration.STELLAR_PUBLIC_TOML_DIRNAME,
          configuration.STELLAR_PUBLIC_TOML_FILENAME,
        ),
    ),
  };
};

export default getNetworkConfig;
