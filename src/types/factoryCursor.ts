interface FactoryCursorRecord {
  network: 'testnet' | 'public';
  factoryContractId: string;
  nextIndex: number;
  nextStateIndex: number;
}

export type { FactoryCursorRecord };
