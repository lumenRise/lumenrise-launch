import type { Chain } from '../network/chain';

interface TestnetActivityRecord {
  _id: Chain;
  network: 'testnet';
  activeUntil: Date;
}

export type { TestnetActivityRecord };
