import env from '../env';

const isR2Configured = (): boolean =>
  Boolean(
    env.R2_ENDPOINT &&
    env.R2_ACCESS_KEY_ID &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET_NAME &&
    env.R2_PUBLIC_BASE_URL,
  );

export default isR2Configured;
