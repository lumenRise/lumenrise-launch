import { Schema, model } from 'mongoose';

import type { BaseTransactionJob as JobRecord } from '../types/base/job';

const schema = new Schema<JobRecord>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true },
    action: { type: String, enum: ['launch', 'trade'], required: true },
    transactionHash: { type: String, required: true },
    contractId: { type: String, required: true },
    status: { type: String, enum: ['queued', 'running', 'completed', 'failed'], default: 'queued' },
    scheduledAt: { type: Date, default: Date.now },
    leaseUntil: { type: Date, default: null },
    attempts: { type: Number, default: 0 },
    observedBlock: { type: Number },
    lastError: { type: String, default: null },
    result: { type: Schema.Types.Mixed, default: null },
  },
  { collection: 'base_transaction_jobs', versionKey: false },
);

schema.index(
  { network: 1, action: 1, transactionHash: 1, contractId: 1 },
  { unique: true, name: 'base_transaction_job_unique' },
);

schema.index(
  { status: 1, scheduledAt: 1, leaseUntil: 1 },
  { name: 'base_transaction_job_pending' },
);

const BaseTransactionJob = model<JobRecord>('BaseTransactionJob', schema);

export default BaseTransactionJob;
