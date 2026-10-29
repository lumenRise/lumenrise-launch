import { Schema, model } from 'mongoose';

import type { BaseCursorRecord } from '../types/base/events';

const schema = new Schema<BaseCursorRecord>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true, immutable: true },
    factoryAddress: { type: String, required: true, immutable: true },
    nextBlock: { type: String, required: true },
    nextLiveBlock: { type: String, default: null },
    historyEndBlock: { type: String, default: null },
    lastLiveScannedAt: { type: Date, default: null },
    previousBlockHash: { type: String, default: null },
    leaseUntil: { type: Date, default: null },
    leaseOwner: { type: String, default: null },
    lastScannedAt: { type: Date, default: null },
  },
  { collection: 'base_event_cursors', versionKey: false },
);

schema.index(
  { network: 1, factoryAddress: 1 },
  { unique: true, name: 'base_event_cursors_factory_unique' },
);

const BaseCursor = model<BaseCursorRecord>('BaseCursor', schema);

export default BaseCursor;
