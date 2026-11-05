import { DeleteObjectCommand } from '@aws-sdk/client-s3';

import env from '../../env';
import getR2Client from '../../storage/getR2Client';

const deleteTokenImageObject = async (objectKey: string): Promise<void> => {
  await getR2Client().send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: objectKey }));
};

export default deleteTokenImageObject;
