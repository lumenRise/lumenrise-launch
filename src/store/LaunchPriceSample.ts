import { Schema, model } from 'mongoose';

import type { PriceSampleRecord } from '../types/market';

const schema = new Schema<PriceSampleRecord>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true },
    contractId: { type: String, required: true },
    bucket: { type: Date, required: true },
    sampledAt: { type: Date, required: true },
    ledger: { type: Number, required: true },
    price: { type: String, required: true },
    priceSort: { type: String, required: true },
  },
  { collection: 'launch_price_samples', versionKey: false },
);

schema.index(
  { network: 1, contractId: 1, bucket: 1 },
  { unique: true, name: 'launch_price_samples_bucket_unique' },
);

schema.index(
  { network: 1, contractId: 1, sampledAt: 1, ledger: 1 },
  { name: 'launch_price_samples_time' },
);

const LaunchPriceSample = model<PriceSampleRecord>('LaunchPriceSample', schema);

export default LaunchPriceSample;
