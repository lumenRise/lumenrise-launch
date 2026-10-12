import type { LaunchData } from './model';

interface LaunchConfigInput {
  rawConfig: unknown;
  rawState: unknown;
  network: LaunchData['network'];
  factoryContractId: string;
  factoryIndex: number;
  contractId: string;
  asOfLedger: number;
  stateAsOfLedger: number;
}

export type { LaunchConfigInput };
