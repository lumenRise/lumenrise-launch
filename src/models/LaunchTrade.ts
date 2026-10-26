import { Schema, model } from 'mongoose';

import type { TradeRecord } from '../types/launch/market';

const schema = new Schema<TradeRecord>(
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
    transactionHash: { type: String, required: true },
    operationIndex: { type: Number, required: true },
    transactionIndex: { type: Number, required: true },
    ledger: { type: Number, required: true },
    tradedAt: { type: Date, required: true },
    trader: { type: String, required: true },
    side: { type: String, enum: ['buy', 'sell'], required: true },
    assetAmount: { type: String, required: true },
    grossAmount: { type: String, required: true },
    executionPrice: { type: String, required: true },
    priceRecordedAt: { type: Date },
  },
  { collection: 'launch_trades', versionKey: false },
);

schema.index(
  { chain: 1, network: 1, transactionHash: 1, operationIndex: 1 },
  { unique: true, name: 'launch_trades_transaction_unique_chain' },
);

schema.index(
  {
    chain: 1,
    network: 1,
    contractId: 1,
    tradedAt: -1,
    ledger: -1,
    transactionIndex: -1,
    operationIndex: -1,
  },
  { name: 'launch_trades_market_time_chain' },
);

schema.index(
  {
    chain: 1,
    network: 1,
    contractId: 1,
    trader: 1,
    tradedAt: -1,
    ledger: -1,
    transactionIndex: -1,
    operationIndex: -1,
  },
  { name: 'launch_trades_wallet_time_chain' },
);

const LaunchTrade = model<TradeRecord>('LaunchTrade', schema);

export default LaunchTrade;
