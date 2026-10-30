import type { HydratedDocument, Types } from 'mongoose';

import type { Chain } from '../network/chain';

interface LaunchHolderJobRecord {
  chain?: Chain;
  network: 'testnet' | 'public';
  contractId: string;
  asset: string;
  address: string;
  requestId: string;
  status: 'queued' | 'running' | 'completed';
  scheduledAt: Date;
  leaseUntil: Date | null;
  attempts: number;
  lastError: string | null;
}

type LaunchHolderJobDocument = HydratedDocument<LaunchHolderJobRecord, { _id: Types.ObjectId }>;

export type { LaunchHolderJobRecord, LaunchHolderJobDocument };
