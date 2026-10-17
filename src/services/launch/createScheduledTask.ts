import log from '../../logger';
import type { ScheduledTask, ScheduledTaskOptions } from '../../types/launch/scheduledTask';

const createScheduledTask = (options: ScheduledTaskOptions): ScheduledTask => {
  let active: Promise<void> | null = null;
  let nextRunAt = 0;
  let stopped = false;
  let retrying = false;
  let requested = false;

  return {
    tick: (): void => {
      if (stopped || active || Date.now() < nextRunAt) {
        return;
      }

      active = Promise.resolve()
        .then(options.run)
        .then(() => {
          nextRunAt = requested ? 0 : Date.now() + options.intervalMs;
          retrying = false;
        })
        .catch((error: unknown) => {
          nextRunAt = Date.now() + options.retryMs;
          retrying = true;

          log.warn(
            { err: error, task: options.name, retryDelayMs: options.retryMs },
            'Launch scheduled task failed',
          );
        })
        .finally(() => {
          requested = false;
          active = null;
        });
    },
    request: (): void => {
      if (stopped || retrying) {
        return;
      }

      if (active) {
        requested = true;

        return;
      }

      nextRunAt = 0;
    },
    stop: async (): Promise<void> => {
      stopped = true;

      await active;
    },
  };
};

export default createScheduledTask;
