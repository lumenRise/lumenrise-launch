interface AssetIdentityRecord {
  network: 'testnet' | 'public';
  assetContractId: string;
  status: 'verified' | 'unverified' | 'unavailable';
  assetCode: string | null;
  issuer: string | null;
  reason: string | null;
  identityCheckedAt: Date;
}

export type { AssetIdentityRecord };
