import { createEnv, defineConfig } from 'envyra';

const schema = defineConfig({
  NODE_ENV: {
    type: 'enum',
    values: ['development', 'test', 'production'],
    default: 'development',
  },
  LOG_LEVEL: {
    type: 'enum',
    values: ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'],
    default: 'info',
    description: 'Logging verbosity.',
  },
  DB_URI: {
    example: 'mongodb://127.0.0.1:27017?replicaSet=rs0&directConnection=true',
    description: 'MongoDB connection string shared with the API.',
  },
  DB_NAME: {
    example: 'lumenrise',
    description: 'MongoDB database name shared with the API.',
  },
  STELLAR_AUTH_NETWORK: {
    type: 'enum',
    values: ['testnet', 'public'],
    default: 'testnet',
    description: 'Stellar network used by the launch factory.',
  },
  STELLAR_RPC_URL: {
    type: 'url',
    example: 'https://soroban-testnet.stellar.org',
    description: 'Stellar RPC endpoint for read-only contract calls.',
  },
  STELLAR_HORIZON_URL: {
    default: '',
    example: 'https://horizon-testnet.stellar.org',
    description: 'Horizon endpoint used to discover issued asset candidates.',
  },
  STELLAR_READ_ACCOUNT: {
    example: 'GDAUDEZPAI4QV2L6A6OOJ27KDQMFPRQJH26AUUTSQOYBNFZWPVYXBHQH',
    description: 'Funded Stellar account used as the source for simulations.',
  },
  LAUNCH_FACTORY_CONTRACT_ID: {
    example: 'CDDM43ZQB34YLYAPAN2EALMRNF32PUYUUOFILKWZJLXHKEQA6JEBN5PC',
    description: 'Bonding-curve factory contract ID.',
  },
  LAUNCH_POLL_INTERVAL_MS: {
    type: 'number',
    default: 5_000,
    description: 'Milliseconds between factory scans.',
  },
});

const source =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production'
    ? undefined
    : 'file';

const env = createEnv(schema, { source });

export default env;
