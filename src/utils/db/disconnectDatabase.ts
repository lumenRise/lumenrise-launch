import mongoose from 'mongoose';

import log from '../../logger';

const disconnectDatabase = async (): Promise<void> => {
  await mongoose.disconnect();

  log.info('Launch database disconnected');
};

export { disconnectDatabase };
