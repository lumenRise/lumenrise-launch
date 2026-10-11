import type { rpc } from '@stellar/stellar-sdk';

interface TradeRecord {
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
  creatorFee: string;
  userAmount: string;
  executionPrice: string;
  priceSort: string;
}

interface TradeCursorRecord {
  network: 'testnet' | 'public';
  contractId: string;
  cursor: string | null;
  nextLedger: number;
  coverageFrom: Date;
  scannedThroughLedger: number;
  scannedAt: Date;
  nextPollAt: Date;
  historyGap: boolean;
  unclassifiedCount: number;
}

interface PriceSampleRecord {
  network: 'testnet' | 'public';
  contractId: string;
  bucket: Date;
  sampledAt: Date;
  ledger: number;
  price: string;
  priceSort: string;
}

interface CurvePriceParams {
  curve?: Record<string, unknown>;
}

interface TradeHealthCacheEntry {
  expiresAt: number;
  value: rpc.Api.GetHealthResponse;
}

export type {
  TradeRecord,
  TradeCursorRecord,
  PriceSampleRecord,
  CurvePriceParams,
  TradeHealthCacheEntry,
};
