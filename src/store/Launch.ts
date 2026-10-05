import { Schema, model } from 'mongoose';

import type { LaunchData } from '../types';

const metadataSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: true },
    logo: { type: String, required: true },
    symbol: { type: String, required: true },
  },
  { _id: false, versionKey: false },
);

const launchSchema = new Schema<LaunchData>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true, immutable: true },
    factoryContractId: { type: String, required: true, immutable: true },
    factoryIndex: { type: Number, required: true, min: 1, immutable: true },
    contractId: { type: String, required: true, immutable: true },
    owner: { type: String, required: true, immutable: true },
    asset: { type: String, required: true, immutable: true },
    pair: { type: String, required: true, immutable: true },
    metadata: { type: metadataSchema, required: true, immutable: true },
    config: { type: Schema.Types.Mixed, required: true, immutable: true },
    state: { type: Schema.Types.Mixed, required: true },
    asOfLedger: { type: Number, required: true, min: 1 },
    observedAt: { type: Date, required: true },
    stateAsOfLedger: { type: Number, required: true, min: 1 },
    stateObservedAt: { type: Date, required: true },
  },
  { collection: 'launches', versionKey: false },
);

launchSchema.index(
  { network: 1, factoryContractId: 1, factoryIndex: 1 },
  { unique: true, name: 'launches_factory_index_unique' },
);

launchSchema.index(
  { network: 1, contractId: 1 },
  { unique: true, name: 'launches_contract_unique' },
);

launchSchema.index({ network: 1, owner: 1, factoryIndex: -1 }, { name: 'launches_owner_list' });

const Launch = model<LaunchData>('Launch', launchSchema);

export default Launch;
