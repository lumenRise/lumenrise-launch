import { Schema, model } from 'mongoose';

import type { TradeRecord } from '../types/market';

const schema = new Schema<TradeRecord>(
  {
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
    creatorFee: { type: String, required: true },
    userAmount: { type: String, required: true },
    executionPrice: { type: String, required: true },
    priceSort: { type: String, required: true },
  },
  { collection: 'launch_trades', versionKey: false },
);

schema.index(
  { network: 1, transactionHash: 1, operationIndex: 1 },
  { unique: true, name: 'launch_trades_transaction_unique' },
);

schema.index(
  {
    network: 1,
    contractId: 1,
    tradedAt: -1,
    ledger: -1,
    transactionIndex: -1,
    operationIndex: -1,
  },
  { name: 'launch_trades_market_time' },
);

schema.index(
  {
    network: 1,
    contractId: 1,
    trader: 1,
    tradedAt: -1,
    ledger: -1,
    transactionIndex: -1,
    operationIndex: -1,
  },
  { name: 'launch_trades_wallet_time' },
);

const LaunchTrade = model<TradeRecord>('LaunchTrade', schema);

export default LaunchTrade;
