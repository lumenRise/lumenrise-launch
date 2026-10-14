import { Schema, model } from 'mongoose';

import type { LaunchHolderRecord } from '../types/launch/holder';

const schema = new Schema<LaunchHolderRecord>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true },
    contractId: { type: String, required: true },
    address: { type: String, required: true },
    asset: { type: String, required: true },
    balance: { type: String, required: true, match: /^[1-9]\d{0,38}$/ },
    balanceSort: { type: String, required: true },
    observedAt: { type: Date, required: true },
  },
  { collection: 'launch_holders', versionKey: false },
);

schema.index(
  { network: 1, contractId: 1, address: 1 },
  { unique: true, name: 'launch_holders_address_unique' },
);

schema.index(
  { network: 1, contractId: 1, balanceSort: -1, address: 1 },
  { name: 'launch_holders_balance' },
);

const LaunchHolder = model<LaunchHolderRecord>('LaunchHolder', schema);

export default LaunchHolder;
