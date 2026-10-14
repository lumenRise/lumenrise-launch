import { Types } from 'mongoose';
import type { ConsumeMessage } from 'amqplib';

const parseJobId = (message: ConsumeMessage): string | null => {
  try {
    const payload: unknown = JSON.parse(message.content.toString('utf8'));

    if (typeof payload !== 'object' || payload === null) {
      return null;
    }

    const jobId = Reflect.get(payload, 'jobId');

    return typeof jobId === 'string' && Types.ObjectId.isValid(jobId) ? jobId : null;
  } catch {
    return null;
  }
};

export default parseJobId;
