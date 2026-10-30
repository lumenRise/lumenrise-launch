import { Schema, model } from 'mongoose';

import type { PriceSampleRecord } from '../types/launch/market';

const schema = new Schema<PriceSampleRecord>(
  {
    chain: {
      type: String,
      enum: ['stellar', 'base'],
      required: true,
      default: 'stellar',
      immutable: true,
    },
    network: { type: String, enum: ['testnet', 'public'], required: true },
    contractId: { type: String, required: true },
    bucket: { type: Date, required: true },
    sampledAt: { type: Date, required: true },
    ledger: { type: Number, required: true },
    observationKey: { type: String },
    price: { type: String, required: true },
    priceSort: { type: String, required: true },
  },
  { collection: 'launch_price_samples', versionKey: false },
);

schema.index(
  { chain: 1, network: 1, contractId: 1, observationKey: 1 },
  {
    unique: true,
    partialFilterExpression: { observationKey: { $type: 'string' } },
    name: 'launch_price_samples_observation_unique_chain',
  },
);

schema.index(
  { chain: 1, network: 1, contractId: 1, bucket: 1 },
  { unique: true, name: 'launch_price_samples_bucket_unique_chain' },
);

schema.index(
  { chain: 1, network: 1, contractId: 1, sampledAt: 1, ledger: 1 },
  { name: 'launch_price_samples_time_chain' },
);

schema.index(
  { chain: 1, network: 1, contractId: 1, ledger: -1, sampledAt: -1 },
  { name: 'launch_price_samples_latest_ledger_chain' },
);

const LaunchPriceSample = model<PriceSampleRecord>('LaunchPriceSample', schema);

export default LaunchPriceSample;
