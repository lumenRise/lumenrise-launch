import type { BaseRuntime } from '../../types/base/runtime';

const runtimes = new Map<string, BaseRuntime>();

const getBaseRuntime = (network: string): BaseRuntime => {
  let runtime = runtimes.get(network);

  if (!runtime) {
    runtime = {
      initialized: false,
      holdingsInitialized: false,
      historyActive: true,
      factoryAt: 0,
      poolAt: 0,
      checkAt: 0,
      cleanupAt: 0,
      progress: new Map(),
      blocks: new Map(),
    };

    runtimes.set(network, runtime);
  }

  return runtime;
};

export default getBaseRuntime;
