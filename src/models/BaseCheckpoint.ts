import { Schema, model } from 'mongoose';

import type { BaseCheckpointRecord } from '../types/base/events';

const schema = new Schema<BaseCheckpointRecord>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true },
    factoryAddress: { type: String, required: true },
    blockNumber: { type: Number, required: true },
    blockHash: { type: String, required: true },
    finalized: { type: Boolean, required: true, default: false },
  },
  { collection: 'base_block_checkpoints', versionKey: false },
);

schema.index(
  { network: 1, factoryAddress: 1, blockNumber: 1 },
  { unique: true, name: 'base_checkpoint_block_unique' },
);

const BaseCheckpoint = model<BaseCheckpointRecord>('BaseCheckpoint', schema);

export default BaseCheckpoint;
