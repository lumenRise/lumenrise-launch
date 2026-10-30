import log from './logger';
import runLaunchWorker from './services/launch/runLaunchWorker';

void runLaunchWorker().catch((error: unknown): void => {
  log.fatal({ err: error }, 'Launch service failed');

  process.exitCode = 1;
});
