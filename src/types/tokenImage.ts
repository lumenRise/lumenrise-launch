import type { Types } from 'mongoose';

interface TokenImageData {
  ownerIdentityId: Types.ObjectId;
  ownerAddress: string;
  network: 'testnet' | 'public';
  objectKey: string;
  publicUrl: string;
  status: 'pending' | 'finalized';
  launchContractId: string | null;
  assetContractId: string | null;
  createdAt: Date;
  finalizedAt: Date | null;
}

export type { TokenImageData };
