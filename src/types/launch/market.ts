interface PriceSampleRecord {
  network: 'testnet' | 'public';
  contractId: string;
  bucket: Date;
  sampledAt: Date;
  ledger: number;
  price: string;
  priceSort: string;
}

export type { PriceSampleRecord };
