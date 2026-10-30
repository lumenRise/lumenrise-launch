import type { ClientSession } from 'mongoose';

import type { Chain } from '../network/chain';

interface LaunchNameRecord {
  chain?: Chain;
  network: 'testnet' | 'public';
  slug: string;
  ownerAddress: string;
  publicUrl: string;
  prelaunchId?: string | null;
  contractId: string | null;
  status: 'reserved' | 'indexed' | 'expired';
}

export type { LaunchNameRecord };

interface IndexedLaunchNameInput {
  chain: 'stellar' | 'base';
  network: 'testnet' | 'public';
  contractId: string;
  ownerAddress: string;
  publicUrl: string;
  slug: string;
  allowSuffix: boolean;
  session?: ClientSession;
}

export type { IndexedLaunchNameInput };
