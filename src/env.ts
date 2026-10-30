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
  STELLAR_PUBLIC_RPC_URL: {
    example: 'https://stellar-mainnet-rpc.example',
  },
  STELLAR_PUBLIC_HORIZON_URL: {
    default: 'https://horizon.stellar.org',
  },
  LAUNCH_PUBLIC_FACTORY_CONTRACT_ID: {
    example: 'CAAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQCAIBAEAQC526',
  },
});

const source =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production' ? undefined : 'file';

const env = createEnv(schema, { source });

export default env;
