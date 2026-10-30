import type { LaunchData } from './model';
import type { Chain } from '../network/chain';

interface LaunchConfigInput {
  rawConfig: unknown;
  rawState: unknown;
  chain?: Chain;
  network: LaunchData['network'];
  factoryContractId: string;
  factoryIndex: number;
  contractId: string;
  asOfLedger: number;
  stateAsOfLedger: number;
}

export type { LaunchConfigInput };
