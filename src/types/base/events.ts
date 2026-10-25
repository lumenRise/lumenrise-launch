import type { Log } from 'viem';

interface BaseTradeEvent {
  trader: string;
  isBuy: boolean;
  assetAmount: bigint;
  grossAmount: bigint;
  creatorFee: bigint;
  userAmount: bigint;
}

interface BaseTradeInput {
  network: 'testnet' | 'public';
  log: Log;
  timestamp: bigint;
}

interface BaseCursorRecord {
  network: 'testnet' | 'public';
  factoryAddress: string;
  nextBlock: string;
  previousBlockHash: string | null;
  leaseUntil: Date | null;
  leaseOwner: string | null;
  lastScannedAt: Date | null;
}

interface BaseCheckpointRecord {
  network: 'testnet' | 'public';
  factoryAddress: string;
  blockNumber: number;
  blockHash: string;
  finalized: boolean;
}

export type { BaseCheckpointRecord, BaseTradeEvent, BaseTradeInput, BaseCursorRecord };
