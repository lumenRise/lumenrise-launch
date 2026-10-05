import { Schema, model } from 'mongoose';

interface FactoryCursorRecord {
  network: 'testnet' | 'public';
  factoryContractId: string;
  nextIndex: number;
  nextStateIndex: number;
}

const factoryCursorSchema = new Schema<FactoryCursorRecord>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true, immutable: true },
    factoryContractId: { type: String, required: true, immutable: true },
    nextIndex: { type: Number, required: true, min: 1 },
    nextStateIndex: { type: Number, default: 1, min: 1 },
  },
  { collection: 'launch_factory_cursors', versionKey: false },
);

factoryCursorSchema.index(
  { network: 1, factoryContractId: 1 },
  { unique: true, name: 'launch_factory_cursors_unique' },
);

const FactoryCursor = model<FactoryCursorRecord>('FactoryCursor', factoryCursorSchema);

export default FactoryCursor;
