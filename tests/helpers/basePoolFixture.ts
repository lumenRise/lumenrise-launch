import { encodeAbiParameters, keccak256, zeroAddress } from 'viem';

import type { BasePool } from '../../src/types/base/pool';
import uniswapDeployments from '../../src/constants/base/uniswapDeployments';

const asset = '0x4444444444444444444444444444444444444444';
const pair = '0x5555555555555555555555555555555555555555';
const curve = '0x1111111111111111111111111111111111111111';
const trader = '0x2222222222222222222222222222222222222222';
const router = '0x9999999999999999999999999999999999999999';
const key = {
  currency0: asset,
  currency1: pair,
  fee: 3000,
  tickSpacing: 60,
  hooks: zeroAddress,
} as const;

const poolId = keccak256(
  encodeAbiParameters(
    [
      { type: 'address' },
      { type: 'address' },
      { type: 'uint24' },
      { type: 'int24' },
      { type: 'address' },
    ],
    [asset, pair, 3000, 60, zeroAddress],
  ),
);

const pool: BasePool = {
  ...uniswapDeployments.testnet,
  ...key,
  poolId,
  sqrtPriceX96: (1n << 96n).toString(),
  tick: 0,
  protocolFee: 0,
  swapFee: 3000,
  liquidity: '340490822233631430',
};

const graduation = {
  settled: true,
  pool_id: poolId,
  token_id: 33196n,
  liquidity: 340490822233631430n,
  asset_deposited: 1000000n * 10n ** 18n,
  pair_deposited: 1000n * 10n ** 6n,
  creator_payout: 1n,
  platform_fee: 1n,
  asset_dust: 1n,
  pair_dust: 1n,
};

export { asset, pair, curve, trader, router, key, poolId, pool, graduation };
