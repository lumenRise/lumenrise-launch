import log from './logger';
import runLaunchWorker from './services/launch/runLaunchWorker';

void runLaunchWorker().catch((error: unknown) => {
  log.fatal({ error }, 'Launch worker failed');
  process.exitCode = 1;
});
