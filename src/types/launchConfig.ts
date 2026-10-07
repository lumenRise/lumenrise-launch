import type { LaunchData } from './launch';

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
