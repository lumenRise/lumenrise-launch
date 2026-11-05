import { S3Client } from '@aws-sdk/client-s3';

import env from '../env';

let client: S3Client | null = null;

const getR2Client = (): S3Client => {
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  return client;
};

export default getR2Client;
