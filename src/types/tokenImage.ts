import type { Types } from 'mongoose';

interface TokenImageData {
  ownerIdentityId: Types.ObjectId;
  ownerAddress: string;
  network: 'testnet' | 'public';
  objectKey: string;
  publicUrl: string;
  status: 'pending' | 'cleanup_ready' | 'deleting' | 'finalized' | 'expired';
  launchContractId: string | null;
  assetContractId: string | null;
  createdAt: Date;
  finalizedAt: Date | null;
  cleanupReadyAt?: Date | null;
  cleanupNextAt?: Date | null;
  cleanupAttempts?: number;
  expiredAt?: Date | null;
}

export type { TokenImageData };
