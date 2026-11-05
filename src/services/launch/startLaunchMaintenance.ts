import log from '../../logger';
import createScheduledTask from './createScheduledTask';
import isR2Configured from '../../storage/isR2Configured';
import type { DomainWorker } from '../../types/messaging/domain';
import syncManagedStellarToml from '../stellar/syncManagedStellarToml';
import processTokenImageCleanup from '../tokenImage/processTokenImageCleanup';

const startLaunchMaintenance = (): DomainWorker => {
  const tasks = [
    createScheduledTask({
      name: 'managed Stellar TOML publication',
      intervalMs: 5000,
      retryMs: 5000,
      run: syncManagedStellarToml,
    }),
    createScheduledTask({
      name: 'launch token image cleanup',
      intervalMs: 3600000,
      retryMs: 60000,
      run: async (): Promise<void> => {
        if (isR2Configured()) {
          await processTokenImageCleanup();
        }
      },
    }),
  ];

  const timer = setInterval((): void => {
    for (const task of tasks) {
      task.tick();
    }
  }, 1000);

  for (const task of tasks) {
    task.tick();
  }

  log.info('Launch domain maintenance started');

  return {
    stop: async (): Promise<void> => {
      clearInterval(timer);

      await Promise.all(tasks.map((task): Promise<void> => task.stop()));
    },
  };
};

export default startLaunchMaintenance;
