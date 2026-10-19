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
  RABBITMQ_URL: {
    default: 'amqp://127.0.0.1:5672',
  },
  DB_NAME: {
    example: 'lumenrise',
  },
  LAUNCH_POLL_INTERVAL_MS: {
    type: 'number',
    default: 5_000,
  },
  STELLAR_TESTNET_RPC_URL: {
    default: 'https://soroban-testnet.stellar.org',
  },
  STELLAR_TESTNET_HORIZON_URL: {
    default: 'https://horizon-testnet.stellar.org',
  },
  LAUNCH_TESTNET_FACTORY_CONTRACT_ID: {
    default: '',
  },
  STELLAR_TESTNET_HOME_DOMAIN: {
    default: '',
  },
  STELLAR_TESTNET_TOML_DIRNAME: {
    default: './storage/testnet',
  },
  STELLAR_TESTNET_TOML_FILENAME: {
    default: 'stellar.toml',
  },
  STELLAR_PUBLIC_RPC_URL: {
    default: '',
  },
  STELLAR_PUBLIC_HORIZON_URL: {
    default: 'https://horizon.stellar.org',
  },
  LAUNCH_PUBLIC_FACTORY_CONTRACT_ID: {
    default: '',
  },
  STELLAR_PUBLIC_HOME_DOMAIN: {
    default: '',
  },
  STELLAR_PUBLIC_TOML_DIRNAME: {
    default: './storage/public',
  },
  STELLAR_PUBLIC_TOML_FILENAME: {
    default: 'stellar.toml',
  },
});

const source =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production' ? undefined : 'file';

const env = createEnv(schema, { source });

export default env;
