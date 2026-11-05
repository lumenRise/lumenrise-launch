interface ProjectVolumeBucket {
  amount: string;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
}

interface ProjectVolume {
  network: 'testnet' | 'public' | 'all';
  currency: 'USDC';
  multiplier: number;
  asOf: string;
  volumeTotal: ProjectVolumeBucket;
  volume24h: ProjectVolumeBucket;
}

export type { ProjectVolume, ProjectVolumeBucket };
