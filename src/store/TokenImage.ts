import { Schema, model } from 'mongoose';

import type { TokenImageData } from '../types/tokenImage';

const schema = new Schema<TokenImageData>(
  {
    ownerIdentityId: { type: Schema.Types.ObjectId, required: true },
    ownerAddress: { type: String, required: true },
    network: { type: String, enum: ['testnet', 'public'], required: true },
    objectKey: { type: String, required: true },
    publicUrl: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'cleanup_ready', 'deleting', 'finalized', 'expired'],
      required: true,
    },
    launchContractId: { type: String, default: null },
    assetContractId: { type: String, default: null },
    createdAt: { type: Date, required: true },
    finalizedAt: { type: Date, default: null },
    cleanupReadyAt: { type: Date, default: null },
    cleanupNextAt: { type: Date, default: null },
    cleanupAttempts: { type: Number, default: 0 },
    expiredAt: { type: Date, default: null },
  },
  { collection: 'token_images', versionKey: false },
);

schema.index(
  { network: 1, assetContractId: 1 },
  {
    unique: true,
    partialFilterExpression: { assetContractId: { $type: 'string' } },
    name: 'token_images_asset_unique',
  },
);
schema.index(
  { network: 1, launchContractId: 1 },
  {
    unique: true,
    partialFilterExpression: { launchContractId: { $type: 'string' } },
    name: 'token_images_launch_unique',
  },
);

const TokenImage = model<TokenImageData>('TokenImage', schema);

export default TokenImage;
