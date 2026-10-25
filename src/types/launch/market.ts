import type { Chain } from '../network/chain';

interface TradeRecord {
  chain?: Chain;
  network: 'testnet' | 'public';
  contractId: string;
  transactionHash: string;
  operationIndex: number;
  transactionIndex: number;
  ledger: number;
  tradedAt: Date;
  trader: string;
  side: 'buy' | 'sell';
  assetAmount: string;
  grossAmount: string;
  executionPrice: string;
  priceRecordedAt?: Date;
}

interface PriceSampleRecord {
  observationKey?: string;
  chain?: Chain;
  network: 'testnet' | 'public';
  contractId: string;
  bucket: Date;
  sampledAt: Date;
  ledger: number;
  price: string;
  priceSort: string;
}

interface MarketIdentity {
  chain?: Chain;
  network: TradeRecord['network'];
  contractId: string;
}

interface PublicMarketIdentity {
  chain?: 'base';
  network: 'testnet' | 'public';
  contractId: string;
}

interface TradePosition {
  tradedAt: Date;
  ledger: number;
  transactionIndex: number;
  operationIndex: number;
}

type ChartRange = '1D' | '1W' | '1M' | '3M' | 'ALL';

export type {
  PublicMarketIdentity,
  TradeRecord,
  PriceSampleRecord,
  MarketIdentity,
  TradePosition,
  ChartRange,
};
