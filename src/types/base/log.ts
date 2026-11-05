import type { BaseContext } from './configuration';

type BaseLogRequest = NonNullable<Parameters<BaseContext['client']['getLogs']>[0]>;

export type { BaseLogRequest };
