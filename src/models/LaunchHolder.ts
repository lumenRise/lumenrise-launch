import { Schema, model } from 'mongoose';

import type { LaunchHolderRecord } from '../types/launch/holder';

const schema = new Schema<LaunchHolderRecord>(
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
    address: { type: String, required: true },
    asset: { type: String, required: true },
    balance: { type: String, required: true, match: /^(0|[1-9]\d{0,38})$/ },
    balanceSort: { type: String, required: true },
    observedBlock: { type: Number },
    observedAt: { type: Date, required: true },
  },
  { collection: 'launch_holders', versionKey: false },
);

schema.index(
  { chain: 1, network: 1, contractId: 1, address: 1 },
  { unique: true, name: 'launch_holders_address_unique_chain' },
);

schema.index(
  { chain: 1, network: 1, contractId: 1, balanceSort: -1, address: 1 },
  { name: 'launch_holders_balance_chain' },
);

const LaunchHolder = model<LaunchHolderRecord>('LaunchHolder', schema);

export default LaunchHolder;
