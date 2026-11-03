import type { Block } from 'viem';

interface BaseRuntime {
  head?: bigint;
  initialized: boolean;
  holdingsInitialized: boolean;
  historyActive: boolean;
  factoryAt: number;
  poolAt: number;
  checkAt: number;
  cleanupAt: number;
  progress: Map<string, boolean>;
  blocks: Map<string, Promise<Block>>;
}

export type { BaseRuntime };
