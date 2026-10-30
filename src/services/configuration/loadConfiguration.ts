import env from '../../env';
import getNetworkConfig from '../network/getNetworkConfig';
import type { Configuration } from '../../types/configuration';
import type { StellarNetwork } from '../../types/network/configuration';
import validateNetworkConfiguration from '../network/validateNetworkConfiguration';

const loadConfiguration = (network: StellarNetwork): Configuration => {
  const configuration = getNetworkConfig(network);
  const pollIntervalMs = env.LAUNCH_POLL_INTERVAL_MS;

  validateNetworkConfiguration(configuration);

  if (!configuration.factoryContractId) {
    throw new Error(`Launch factory must be configured for ${network}`);
  }

  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1000 || pollIntervalMs > 60000) {
    throw new Error('LAUNCH_POLL_INTERVAL_MS must be between 1000 and 60000');
  }

  return {
    network,
    networkPassphrase: configuration.networkPassphrase,
    factoryContractId: configuration.factoryContractId,
    rpcUrl: configuration.rpcUrl,
    horizonUrl: configuration.horizonUrl,
    dbUri: env.DB_URI,
    dbName: env.DB_NAME,
    pollIntervalMs,
    rabbitmqUrl: env.RABBITMQ_URL,
  };
};

export { loadConfiguration };
