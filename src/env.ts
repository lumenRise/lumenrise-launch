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
  R2_ENDPOINT: {
    example: 'https://<account_id>.r2.cloudflarestorage.com',
  },
  R2_ACCESS_KEY_ID: {
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  },
  R2_SECRET_ACCESS_KEY: {
    secret: true,
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
  },
  R2_BUCKET_NAME: {
    example: 'my-bucket-name',
  },
  R2_PUBLIC_BASE_URL: {
    example: 'https://images.lumenrise.app',
  },
  BASE_LOG_BLOCK_RANGE: {
    type: 'number',
    default: 1000,
  },
  BASE_TESTNET_RPC_URL: {
    example: 'https://base-sepolia-rpc.example',
  },
  BASE_PUBLIC_RPC_URL: {
    example: 'https://base-mainnet-rpc.example',
  },
  BASE_TESTNET_FACTORY_ADDRESS: {
    example: '0x1111111111111111111111111111111111111111',
  },
  BASE_PUBLIC_FACTORY_ADDRESS: {
    example: '0x1111111111111111111111111111111111111111',
  },
  BASE_TESTNET_DEPLOYMENT_BLOCK: {
    example: '1',
  },
  BASE_PUBLIC_DEPLOYMENT_BLOCK: {
    example: '1',
  },
  STELLAR_TESTNET_RPC_URL: {
    default: 'https://soroban-testnet.stellar.org',
  },
  STELLAR_TESTNET_HORIZON_URL: {
    default: 'https://horizon-testnet.stellar.org',
  },
  LAUNCH_TESTNET_FACTORY_CONTRACT_ID: {
    example: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
  },
  STELLAR_TESTNET_HOME_DOMAIN: {
    example: 'testnet.example',
  },
  STELLAR_TESTNET_TOML_DIRNAME: {
    default: './storage/testnet',
  },
  STELLAR_TESTNET_TOML_FILENAME: {
    default: 'stellar.toml',
  },
  TESTNET_TOML: {
    example: './storage/testnet/stellar.toml',
    required: false,
  },
  STELLAR_PUBLIC_RPC_URL: {
    example: 'https://stellar-mainnet-rpc.example',
  },
  STELLAR_PUBLIC_HORIZON_URL: {
    default: 'https://horizon.stellar.org',
  },
  LAUNCH_PUBLIC_FACTORY_CONTRACT_ID: {
    example: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
  },
  STELLAR_PUBLIC_HOME_DOMAIN: {
    example: 'mainnet.example',
  },
  STELLAR_PUBLIC_TOML_DIRNAME: {
    default: './storage/public',
  },
  STELLAR_PUBLIC_TOML_FILENAME: {
    default: 'stellar.toml',
  },
  PUBLIC_TOML: {
    example: './storage/public/stellar.toml',
    required: false,
  },
});

const source =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production' ? undefined : 'file';

const env = createEnv(schema, { source });

export default env;
