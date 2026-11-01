import type { Address, Hex, Log } from 'viem';

import type { BaseContext } from './configuration';

interface BasePool {
  poolId: Hex;
  poolManager: Address;
  stateView: Address;
  positionManager: Address;
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
  sqrtPriceX96: string;
  tick: number;
  protocolFee: number;
  swapFee: number;
  liquidity: string;
}

interface BasePoolRead {
  context: BaseContext;
  address: Address;
  blockNumber: bigint;
  asset: Address;
  pair: Address;
  assetDecimals: number;
}

interface BasePoolSnapshot {
  pool: BasePool;
  graduationState: Record<string, unknown>;
  price: bigint;
}

interface BasePoolTradeInput {
  network: 'testnet' | 'public';
  contractId: string;
  asset: string;
  assetDecimals: number;
  pool: BasePool;
  log: Log;
  timestamp: bigint;
  trader: Address;
}

export type { BasePool, BasePoolRead, BasePoolSnapshot, BasePoolTradeInput };
