import { Schema, model } from 'mongoose';

import type { LaunchNameRecord } from '../types/launch/name';

const schema = new Schema<LaunchNameRecord>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true, immutable: true },
    slug: { type: String, required: true, immutable: true },
    ownerAddress: { type: String, required: true },
    publicUrl: { type: String, required: true },
    status: { type: String, enum: ['reserved', 'indexed', 'expired'], required: true },
    contractId: { type: String, default: null },
  },
  { collection: 'launch_names', versionKey: false },
);

schema.index({ network: 1, slug: 1 }, { unique: true, name: 'launch_names_slug_unique' });

const LaunchName = model<LaunchNameRecord>('LaunchName', schema);

export default LaunchName;
