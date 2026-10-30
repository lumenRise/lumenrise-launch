import tokenAbi from '../../constants/base/tokenAbi';
import launchAbi from '../../constants/base/launchAbi';
import type { BaseLaunchRead, BaseLaunchSnapshot } from '../../types/base/launch';

const readBaseLaunch = async (input: BaseLaunchRead): Promise<BaseLaunchSnapshot> => {
  const { context, address, blockNumber } = input;

  const config = await context.client.readContract({
    address,
    abi: launchAbi,
    functionName: 'get_config',
    blockNumber,
  });

  const state = await context.client.readContract({
    address,
    abi: launchAbi,
    functionName: 'get_state',
    blockNumber,
  });

  const price = await context.client.readContract({
    address,
    abi: launchAbi,
    functionName: 'current_price',
    blockNumber,
  });

  if (config.factory.toLowerCase() !== context.configuration.factoryAddress) {
    throw new Error('Base launch factory mismatch');
  }

  const assetDecimals = await context.client.readContract({
    address: config.params.asset,
    abi: tokenAbi,
    functionName: 'decimals',
    blockNumber,
  });

  const pairDecimals = await context.client.readContract({
    address: config.params.pair,
    abi: tokenAbi,
    functionName: 'decimals',
    blockNumber,
  });

  if (
    assetDecimals > 18 ||
    pairDecimals > 18 ||
    price <= 0n ||
    price >= 2n ** 256n ||
    state.buyer_count > BigInt(Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error('Unsupported Base token decimals, price or buyer count');
  }

  const plainConfig = JSON.parse(
    JSON.stringify(config, (_key: string, value: unknown): unknown =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  ) as Record<string, unknown>;

  const plainState = JSON.parse(
    JSON.stringify(state, (_key: string, value: unknown): unknown =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  ) as Record<string, unknown>;

  plainState.buyer_count = Number(state.buyer_count);

  const params = plainConfig.params as Record<string, unknown>;
  const vesting = params.vesting as Record<string, unknown>;
  const schedule = ['Daily', 'Weekly', 'Monthly'][config.params.vesting.schedule];

  if (!schedule) {
    throw new Error('Invalid Base vesting schedule');
  }

  params.owner = config.params.owner.toLowerCase();

  params.asset = config.params.asset.toLowerCase();

  params.pair = config.params.pair.toLowerCase();

  vesting.schedule = schedule;

  return { config, plainConfig, state: plainState, price, assetDecimals, pairDecimals };
};

export default readBaseLaunch;
