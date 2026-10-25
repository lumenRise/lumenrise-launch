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
