import { Networks, StrKey } from '@stellar/stellar-sdk';

import env from './env';

interface Configuration {
  network: 'testnet' | 'public';
  networkPassphrase: string;
  factoryContractId: string;
  observerAddress: string;
  rpcUrl: string;
  dbUri: string;
  dbName: string;
  pollIntervalMs: number;
}

const loadConfiguration = (): Configuration => {
  const network = env.STELLAR_AUTH_NETWORK;
  const factoryContractId = env.LAUNCH_FACTORY_CONTRACT_ID;
  const observerAddress = env.STELLAR_READ_ACCOUNT;
  const rpcUrl = env.STELLAR_RPC_URL;
  const pollIntervalMs = env.LAUNCH_POLL_INTERVAL_MS;

  if (!StrKey.isValidContract(factoryContractId)) {
    throw new Error('LAUNCH_FACTORY_CONTRACT_ID must be a Stellar contract address');
  }

  if (!StrKey.isValidEd25519PublicKey(observerAddress)) {
    throw new Error('STELLAR_READ_ACCOUNT must be a funded Stellar account address');
  }

  if (!Number.isInteger(pollIntervalMs) || pollIntervalMs < 1000 || pollIntervalMs > 60000) {
    throw new Error('LAUNCH_POLL_INTERVAL_MS must be between 1000 and 60000');
  }

  const url = new URL(rpcUrl);

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('STELLAR_RPC_URL must be an HTTP or HTTPS URL');
  }

  if (network === 'public' && url.protocol !== 'https:') {
    throw new Error('STELLAR_RPC_URL must use HTTPS on the public network');
  }

  return {
    network,
    networkPassphrase: network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC,
    factoryContractId,
    observerAddress,
    rpcUrl,
    dbUri: env.DB_URI,
    dbName: env.DB_NAME,
    pollIntervalMs,
  };
};

export { loadConfiguration };
export type { Configuration };
