import { createEnv } from 'envyra';

import schema from './env.config';

const source =
  process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'production'
    ? undefined
    : 'file';

const env = createEnv(schema, { source });

export default env;
