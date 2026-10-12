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
  },
  DB_URI: {
    example: 'mongodb://127.0.0.1:27017?replicaSet=rs0&directConnection=true',
  },
  DB_NAME: {
    example: 'lumenrise',
  },
  STELLAR_AUTH_NETWORK: {
    type: 'enum',
    values: ['testnet', 'public'],
    default: 'testnet',
  },
  STELLAR_RPC_URL: {
    type: 'url',
    example: 'https://soroban-testnet.stellar.org',
  },
  STELLAR_HORIZON_URL: {
    example: 'https://horizon-testnet.stellar.org',
  },
  STELLAR_READ_ACCOUNT: {
    example: 'GDAUDEZPAI4QV2L6A6OOJ27KDQMFPRQJH26AUUTSQOYBNFZWPVYXBHQH',
  },
  LAUNCH_FACTORY_CONTRACT_ID: {
    example: 'CDDM43ZQB34YLYAPAN2EALMRNF32PUYUUOFILKWZJLXHKEQA6JEBN5PC',
  },
  LAUNCH_POLL_INTERVAL_MS: {
    type: 'number',
    default: 5_000,
  },
});

const source =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production' ? undefined : 'file';

const env = createEnv(schema, { source });

export default env;
