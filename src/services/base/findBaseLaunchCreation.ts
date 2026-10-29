import { BaseError } from 'viem';
import type { Address } from 'viem';

import launchAbi from '../../constants/base/launchAbi';
import factoryAbi from '../../constants/base/factoryAbi';
import type { BaseContext } from '../../types/base/configuration';
import type { BaseRecoveredCreation } from '../../types/base/launch';

const findBaseLaunchCreation = async (
  context: BaseContext,
  address: Address,
  atBlock: bigint,
): Promise<BaseRecoveredCreation | null> => {
  let config;

  try {
    config = await context.client.readContract({
      address,
      abi: launchAbi,
      functionName: 'get_config',
      blockNumber: atBlock,
    });
  } catch (error) {
    if (error instanceof BaseError) {
      const invalid = error.walk(
        (cause): boolean =>
          cause instanceof Error &&
          (cause.name === 'ContractFunctionRevertedError' ||
            cause.name === 'ContractFunctionZeroDataError' ||
            cause.name.startsWith('AbiDecoding')),
      );

      if (
        invalid instanceof Error &&
        (invalid.name === 'ContractFunctionRevertedError' ||
          invalid.name === 'ContractFunctionZeroDataError' ||
          invalid.name.startsWith('AbiDecoding'))
      ) {
        return null;
      }
    }

    throw error;
  }

  if (config.factory.toLowerCase() !== context.configuration.factoryAddress) {
    return null;
  }

  let lower = context.configuration.deploymentBlock;
  let upper = atBlock;

  while (lower < upper) {
    const middle = (lower + upper) / 2n;
    const code = await context.client.getCode({ address, blockNumber: middle });

    if (code && code !== '0x') {
      upper = middle;
    } else {
      lower = middle + 1n;
    }
  }

  const events = await context.client.getLogs({
    address: context.configuration.factoryAddress,
    event: factoryAbi.find((item) => item.type === 'event' && item.name === 'LaunchCreated')!,
    args: { curve: address },
    fromBlock: lower,
    toBlock: lower,
    strict: true,
  });

  const event = events.find(
    (item): boolean => item.args.curve?.toLowerCase() === address.toLowerCase(),
  );

  if (!event) {
    return null;
  }

  if (event.removed || event.blockNumber !== lower || event.blockHash === null) {
    throw new Error('Unknown Base trade emitter has no verified factory creation event');
  }

  const block = await context.client.getBlock({ blockNumber: lower });

  if (block.hash !== event.blockHash) {
    throw new Error('Recovered Base launch creation is no longer canonical');
  }

  return {
    asset: config.params.asset,
    event,
    number: lower,
    hash: block.hash!,
    timestamp: block.timestamp,
  };
};

export default findBaseLaunchCreation;
