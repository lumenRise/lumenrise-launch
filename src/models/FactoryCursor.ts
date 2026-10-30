import { Schema, model } from 'mongoose';

import type { FactoryCursorRecord } from '../types/launch/factoryCursor';

const factoryCursorSchema = new Schema<FactoryCursorRecord>(
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
    nextIndex: { type: Number, required: true, min: 1 },
    nextStateIndex: { type: Number, default: 1, min: 1 },
  },
  { collection: 'launch_factory_cursors', versionKey: false },
);

factoryCursorSchema.index(
  { chain: 1, network: 1, factoryContractId: 1 },
  { unique: true, name: 'launch_factory_cursors_unique_chain' },
);

const FactoryCursor = model<FactoryCursorRecord>('FactoryCursor', factoryCursorSchema);

export default FactoryCursor;
