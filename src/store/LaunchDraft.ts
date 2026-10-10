import { Schema, model } from 'mongoose';

interface LaunchDraftRecord {
  network: 'testnet' | 'public';
  ownerAddress: string;
  status: 'editing' | 'submitted' | 'confirmed' | 'unmatched' | 'failed';
  assetContractId: string | null;
  params: Record<string, unknown> | null;
  transactionHash: string | null;
  verifiedContractId: string | null;
  imageId: Schema.Types.ObjectId | null;
  launchContractId: string | null;
  confirmedAt: Date | null;
  submittedAt: Date | null;
  nextMatchAt: Date | null;
  matchAttempts: number;
}

const schema = new Schema<LaunchDraftRecord>(
  {
    network: String,
    ownerAddress: String,
    status: String,
    assetContractId: String,
    params: Schema.Types.Mixed,
    transactionHash: String,
    verifiedContractId: String,
    imageId: Schema.Types.ObjectId,
    launchContractId: String,
    confirmedAt: Date,
    submittedAt: Date,
    nextMatchAt: Date,
    matchAttempts: Number,
  },
  { collection: 'launch_drafts', strict: false, versionKey: false },
);

schema.index(
  { network: 1, transactionHash: 1 },
  {
    unique: true,
    name: 'launch_drafts_transaction_unique',
    partialFilterExpression: { transactionHash: { $type: 'string' } },
  },
);

schema.index(
  { network: 1, launchContractId: 1 },
  {
    unique: true,
    name: 'launch_drafts_launch_unique',
    partialFilterExpression: { launchContractId: { $type: 'string' } },
  },
);

schema.index(
  { imageId: 1 },
  {
    unique: true,
    name: 'launch_drafts_image_unique',
    partialFilterExpression: { imageId: { $type: 'objectId' } },
  },
);

const LaunchDraft = model<LaunchDraftRecord>('LaunchDraft', schema);

export default LaunchDraft;
