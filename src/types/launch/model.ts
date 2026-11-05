import type { BasePool } from '../base/pool';
import type { Chain } from '../network/chain';

interface LaunchData {
  chain?: Chain;
  network: 'testnet' | 'public';
  factoryContractId: string;
  prelaunchId?: string | null;
  factoryIndex: number;
  contractId: string;
  slug: string;
  owner: string;
  asset: string;
  pair: string;
  assetDecimals?: number;
  pairDecimals?: number;
  metadata: {
    name: string;
    description: string;
    logo: string;
    symbol: string;
    website?: string;
    xAccount?: string;
  };
  config: Record<string, unknown>;
  state: Record<string, unknown>;
  pool?: BasePool | null;
  graduationState?: Record<string, unknown> | null;
  asOfLedger: number;
  observedAt: Date;
  createdAt?: Date | null;
  creationLedger?: number | null;
  creationTransactionHash?: string | null;
  tradeCoverageFrom?: number;
  graduationBlock?: number | null;
  graduationLogIndex?: number | null;
  poolNextBlock?: string | null;
  holderSource?: string;
  stateAsOfLedger: number;
  priceAsOfLedger?: number;
  recordedHoldingsVersion?: number;
  stateObservedAt: Date;
  nextStatePollAt?: Date | null;
}

export type { LaunchData };
