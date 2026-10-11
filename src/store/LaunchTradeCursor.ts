import { Schema, model } from 'mongoose';

import type { TradeCursorRecord } from '../types/market';

const schema = new Schema<TradeCursorRecord>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true },
    contractId: { type: String, required: true },
    cursor: { type: String, default: null },
    nextLedger: { type: Number, required: true },
    coverageFrom: { type: Date, required: true },
    scannedThroughLedger: { type: Number, required: true },
    scannedAt: { type: Date, required: true },
    nextPollAt: { type: Date, required: true },
    historyGap: { type: Boolean, required: true },
    unclassifiedCount: { type: Number, required: true },
  },
  { collection: 'launch_trade_cursors', versionKey: false },
);

schema.index(
  { network: 1, contractId: 1 },
  { unique: true, name: 'launch_trade_cursors_unique' },
);

schema.index(
  { network: 1, nextPollAt: 1 },
  { name: 'launch_trade_cursors_due' },
);

const LaunchTradeCursor = model<TradeCursorRecord>('LaunchTradeCursor', schema);

export default LaunchTradeCursor;
