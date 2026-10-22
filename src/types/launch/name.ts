interface LaunchNameRecord {
  network: 'testnet' | 'public';
  slug: string;
  ownerAddress: string;
  publicUrl: string;
  contractId: string | null;
  status: 'reserved' | 'indexed' | 'expired';
}

export type { LaunchNameRecord };
