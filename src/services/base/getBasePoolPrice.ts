const getBasePoolPrice = (
  sqrtPriceX96: bigint,
  assetIsCurrency0: boolean,
  assetDecimals: number,
): bigint => {
  if (
    sqrtPriceX96 <= 0n ||
    sqrtPriceX96 >= 2n ** 160n ||
    !Number.isInteger(assetDecimals) ||
    assetDecimals < 0 ||
    assetDecimals > 18
  ) {
    throw new Error('Invalid Base pool price input');
  }

  const squared = sqrtPriceX96 * sqrtPriceX96;
  const scale = 10n ** BigInt(assetDecimals);
  const numerator = assetIsCurrency0 ? squared * scale : (1n << 192n) * scale;
  const denominator = assetIsCurrency0 ? 1n << 192n : squared;
  const price = (numerator + denominator - 1n) / denominator;

  if (price >= 2n ** 256n) {
    throw new Error('Base pool price exceeds the supported range');
  }

  return price;
};

export default getBasePoolPrice;
