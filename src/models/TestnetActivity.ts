import { Schema, model } from 'mongoose';

import type { TestnetActivityRecord } from '../types/launch/testnetActivity';

const schema = new Schema<TestnetActivityRecord>(
  {
    _id: { type: String, enum: ['stellar', 'base'], required: true },
    network: { type: String, enum: ['testnet'], required: true, immutable: true },
    activeUntil: { type: Date, required: true },
  },
  { collection: 'launch_testnet_activity', versionKey: false, bufferCommands: false },
);

const TestnetActivity = model<TestnetActivityRecord>('TestnetActivity', schema);

export default TestnetActivity;
