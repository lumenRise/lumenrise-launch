import { encodeAbiParameters, keccak256, zeroAddress, zeroHash } from 'viem';

import getBasePoolPrice from './getBasePoolPrice';
import poolAbi from '../../constants/base/poolAbi';
import launchAbi from '../../constants/base/launchAbi';
import uniswapDeployments from '../../constants/base/uniswapDeployments';
import type { BasePoolRead, BasePoolSnapshot } from '../../types/base/pool';

const readBasePool = async (input: BasePoolRead): Promise<BasePoolSnapshot> => {
  const { context, address, blockNumber, asset, pair, assetDecimals } = input;
  const deployment = uniswapDeployments[context.configuration.network];

  const graduation = await context.client.readContract({
    address,
    abi: launchAbi,
    functionName: 'graduation_state',
    blockNumber,
  });

  if (!graduation.settled || graduation.pool_id === zeroHash) {
    throw new Error('Graduated Base launch has no settled pool');
  }

  const [key] = await context.client.readContract({
    address: deployment.positionManager,
    abi: poolAbi,
    functionName: 'getPoolAndPositionInfo',
    args: [graduation.token_id],
    blockNumber,
  });

  const poolId = keccak256(
    encodeAbiParameters(
      [
        { type: 'address' },
        { type: 'address' },
        { type: 'uint24' },
        { type: 'int24' },
        { type: 'address' },
      ],
      [key.currency0, key.currency1, key.fee, key.tickSpacing, key.hooks],
    ),
  );

  const currencies = [asset.toLowerCase(), pair.toLowerCase()].sort();

  if (
    poolId !== graduation.pool_id ||
    key.hooks !== zeroAddress ||
    key.currency0.toLowerCase() !== currencies[0] ||
    key.currency1.toLowerCase() !== currencies[1]
  ) {
    throw new Error('Base graduation pool does not match its launch');
  }

  const [sqrtPriceX96, tick, protocolFee, swapFee] = await context.client.readContract({
    address: deployment.stateView,
    abi: poolAbi,
    functionName: 'getSlot0',
    args: [poolId],
    blockNumber,
  });

  const liquidity = await context.client.readContract({
    address: deployment.stateView,
    abi: poolAbi,
    functionName: 'getLiquidity',
    args: [poolId],
    blockNumber,
  });

  const graduationState = JSON.parse(
    JSON.stringify(graduation, (_key: string, value: unknown): unknown =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  ) as Record<string, unknown>;

  return {
    pool: {
      poolId,
      ...deployment,
      currency0: key.currency0.toLowerCase() as typeof asset,
      currency1: key.currency1.toLowerCase() as typeof asset,
      fee: key.fee,
      tickSpacing: key.tickSpacing,
      hooks: key.hooks,
      sqrtPriceX96: sqrtPriceX96.toString(),
      tick,
      protocolFee,
      swapFee,
      liquidity: liquidity.toString(),
    },
    graduationState,
    price: getBasePoolPrice(
      sqrtPriceX96,
      key.currency0.toLowerCase() === asset.toLowerCase(),
      assetDecimals,
    ),
  };
};

export default readBasePool;
