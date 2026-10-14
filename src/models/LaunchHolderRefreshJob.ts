import { Schema, model } from 'mongoose';

import type { LaunchHolderJobRecord } from '../types/launch/holderJob';

const schema = new Schema<LaunchHolderJobRecord>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true },
    contractId: { type: String, required: true },
    asset: { type: String, required: true },
    address: { type: String, required: true },
    requestId: { type: String, required: true },
    status: { type: String, enum: ['queued', 'running', 'completed'], required: true },
    scheduledAt: { type: Date, required: true },
    leaseUntil: { type: Date, default: null },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, default: null, maxlength: 2000 },
  },
  { collection: 'launch_holder_refresh_jobs', versionKey: false },
);

schema.index(
  { network: 1, contractId: 1, address: 1 },
  { unique: true, name: 'launch_holder_jobs_wallet_unique' },
);

schema.index(
  { network: 1, status: 1, scheduledAt: 1, leaseUntil: 1 },
  { name: 'launch_holder_jobs_due' },
);

const LaunchHolderRefreshJob = model<LaunchHolderJobRecord>('LaunchHolderRefreshJob', schema);

export default LaunchHolderRefreshJob;
