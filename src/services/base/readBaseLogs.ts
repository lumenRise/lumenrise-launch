import type { Log } from 'viem';

import type { BaseLogRequest } from '../../types/base/log';
import type { BaseContext } from '../../types/base/configuration';

const readBaseLogs = async (context: BaseContext, request: BaseLogRequest): Promise<Log[]> => {
  try {
    return await context.client.getLogs(request);
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !/limit|range|too many|response size|result size|query returned/i.test(error.message) ||
      typeof request.fromBlock !== 'bigint' ||
      typeof request.toBlock !== 'bigint' ||
      request.fromBlock >= request.toBlock
    ) {
      throw error;
    }

    const middle = (request.fromBlock + request.toBlock) / 2n;
    const earlier = await readBaseLogs(context, { ...request, toBlock: middle });
    const later = await readBaseLogs(context, { ...request, fromBlock: middle + 1n });

    return [...earlier, ...later];
  }
};

export default readBaseLogs;
