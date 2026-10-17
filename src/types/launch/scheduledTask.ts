interface ScheduledTaskOptions {
  name: string;
  intervalMs: number;
  retryMs: number;
  run: () => Promise<unknown>;
}

interface ScheduledTask {
  tick: () => void;
  request: () => void;
  stop: () => Promise<void>;
}

export type { ScheduledTask, ScheduledTaskOptions };
