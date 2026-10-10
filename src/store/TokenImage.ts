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

const TokenImage = model<TokenImageData>('TokenImage', schema);

export default TokenImage;
