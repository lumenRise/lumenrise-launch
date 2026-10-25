import { Schema, model } from 'mongoose';

import type { LaunchData } from '../types/launch/model';

const metadataSchema = new Schema(
  {
    name: { type: String, required: true, immutable: true },
    description: { type: String, default: '' },
    logo: { type: String, required: true, immutable: true },
    symbol: { type: String, required: true, immutable: true },
    website: { type: String },
    xAccount: { type: String },
  },
  { _id: false, versionKey: false },
);

const launchSchema = new Schema<LaunchData>(
  {
    chain: {
      type: String,
      enum: ['stellar', 'base'],
      required: true,
      default: 'stellar',
      immutable: true,
    },
    network: {
      type: String,
      enum: ['testnet', 'public'],
      required: true,
      immutable: true,
    },
    factoryContractId: { type: String, required: true, immutable: true },
    prelaunchId: { type: String, default: null, immutable: true },
    factoryIndex: { type: Number, required: true, min: 1, immutable: true },
    contractId: { type: String, required: true, immutable: true },
    slug: { type: String, required: true, immutable: true },
    owner: { type: String, required: true, immutable: true },
    asset: { type: String, required: true, immutable: true },
    pair: { type: String, required: true, immutable: true },
    metadata: { type: metadataSchema, required: true },
    config: { type: Schema.Types.Mixed, required: true, immutable: true },
    state: { type: Schema.Types.Mixed, required: true },
    asOfLedger: { type: Number, required: true, min: 1 },
    observedAt: { type: Date, required: true },
    createdAt: { type: Date, default: null },
    creationLedger: { type: Number, min: 1, default: null },
    creationTransactionHash: { type: String, default: null },
    stateAsOfLedger: { type: Number, required: true, min: 1 },
    stateObservedAt: { type: Date, required: true },
    nextStatePollAt: { type: Date, default: () => new Date(0) },
  },
  { collection: 'launches', versionKey: false },
);

launchSchema.index(
  { chain: 1, network: 1, factoryContractId: 1, factoryIndex: 1 },
  { unique: true, name: 'launches_factory_index_unique_chain' },
);

launchSchema.index(
  { chain: 1, network: 1, contractId: 1 },
  { unique: true, name: 'launches_contract_unique_chain' },
);

launchSchema.index(
  { chain: 1, network: 1, owner: 1, factoryIndex: -1 },
  { name: 'launches_owner_list_chain' },
);

launchSchema.index(
  { chain: 1, network: 1, factoryContractId: 1, nextStatePollAt: 1, factoryIndex: 1 },
  { name: 'launches_state_poll_due_chain' },
);

launchSchema.index(
  { chain: 1, network: 1, createdAt: -1, contractId: 1 },
  { name: 'launches_creation_list_chain' },
);

launchSchema.index(
  { chain: 1, network: 1, slug: 1 },
  {
    unique: true,
    partialFilterExpression: { slug: { $type: 'string' } },
    name: 'launches_slug_unique_chain',
  },
);

const Launch = model<LaunchData>('Launch', launchSchema);

export default Launch;
