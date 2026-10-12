import mongoose from 'mongoose';

import log from '../../logger';
import type { Configuration } from '../../types/configuration';

const connectDatabase = async (configuration: Configuration): Promise<void> => {
  mongoose.set('autoIndex', false);

  await mongoose.connect(configuration.dbUri, { dbName: configuration.dbName });

  log.info({ database: configuration.dbName }, 'Launch database connected');
};

export { connectDatabase };
