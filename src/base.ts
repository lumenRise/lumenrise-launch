import log from './logger';
import runBaseWorker from './services/base/runBaseWorker';

void runBaseWorker().catch((error: unknown): void => {
  log.fatal({ error }, 'Base worker failed');

  process.exitCode = 1;
});
