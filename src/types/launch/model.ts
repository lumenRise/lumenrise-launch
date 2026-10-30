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
  asOfLedger: number;
  observedAt: Date;
  createdAt?: Date | null;
  creationLedger?: number | null;
  creationTransactionHash?: string | null;
  stateAsOfLedger: number;
  stateObservedAt: Date;
  nextStatePollAt?: Date | null;
}

export type { LaunchData };
