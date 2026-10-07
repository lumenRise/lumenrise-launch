import { Schema, model } from 'mongoose';

import type { AssetIdentityRecord } from '../types/assetIdentity';

const assetIdentitySchema = new Schema<AssetIdentityRecord>(
  {
    network: { type: String, enum: ['testnet', 'public'], required: true },
    assetContractId: { type: String, required: true },
    status: {
      type: String,
      enum: ['verified', 'unverified', 'unavailable'],
      required: true,
    },
    assetCode: { type: String, default: null },
    issuer: { type: String, default: null },
    reason: { type: String, default: null },
    identityCheckedAt: { type: Date, required: true },
  },
  { collection: 'asset_identities', versionKey: false },
);

assetIdentitySchema.index(
  { network: 1, assetContractId: 1 },
  { unique: true, name: 'asset_identity_contract_unique' },
);

assetIdentitySchema.index(
  { network: 1, assetCode: 1, issuer: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'verified' },
    name: 'asset_identity_issuer_code_unique',
  },
);

const AssetIdentity = model<AssetIdentityRecord>(
  'AssetIdentity',
  assetIdentitySchema,
);

export default AssetIdentity;
