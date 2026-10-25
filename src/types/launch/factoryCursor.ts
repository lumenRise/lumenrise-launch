import type { Chain } from '../network/chain';

interface FactoryCursorRecord {
  chain?: Chain;
  network: 'testnet' | 'public';
  factoryContractId: string;
  nextIndex: number;
  nextStateIndex: number;
}

export type { FactoryCursorRecord };
