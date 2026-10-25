import type { ClientSession } from 'mongoose';
import type { Log, Address, ContractFunctionReturnType } from 'viem';

import type { BaseContext } from './configuration';
import type launchAbi from '../../constants/base/launchAbi';

interface BaseWriteContext extends BaseContext {
  leaseOwner: string;
}

interface BaseBlockInput {
  context: BaseWriteContext;
  logs: Log[];
  number: bigint;
  hash: string;
  timestamp: bigint;
  advance?: boolean;
  refreshDue?: boolean;
}

interface BaseEventContext extends BaseContext {
  session: ClientSession;
}

interface BaseLaunchRead {
  context: BaseContext;
  address: Address;
  blockNumber: bigint;
}

interface BaseLaunchSnapshot {
  config: ContractFunctionReturnType<typeof launchAbi, 'view', 'get_config'>;
  plainConfig: Record<string, unknown>;
  state: Record<string, unknown>;
  price: bigint;
}

export type {
  BaseLaunchSnapshot,
  BaseWriteContext,
  BaseBlockInput,
  BaseEventContext,
  BaseLaunchRead,
};
