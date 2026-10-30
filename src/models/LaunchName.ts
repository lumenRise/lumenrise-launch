import { Schema, model } from 'mongoose';

import type { LaunchNameRecord } from '../types/launch/name';

const schema = new Schema<LaunchNameRecord>(
  {
    chain: {
      type: String,
      enum: ['stellar', 'base'],
      required: true,
      default: 'stellar',
      immutable: true,
    },
    network: { type: String, enum: ['testnet', 'public'], required: true, immutable: true },
    slug: { type: String, required: true, immutable: true },
    ownerAddress: { type: String, required: true },
    publicUrl: { type: String, required: true },
    status: { type: String, enum: ['reserved', 'indexed', 'expired'], required: true },
    prelaunchId: { type: String, default: null },
    contractId: { type: String, default: null },
  },
  { collection: 'launch_names', versionKey: false },
);

schema.index(
  { chain: 1, network: 1, slug: 1 },
  { unique: true, name: 'launch_names_slug_unique_chain' },
);

const LaunchName = model<LaunchNameRecord>('LaunchName', schema);

export default LaunchName;
