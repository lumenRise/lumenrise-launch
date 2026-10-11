const parseTradeInteger = (value: unknown): bigint => {
  if (
    typeof value !== 'bigint' &&
    !(typeof value === 'number' && Number.isSafeInteger(value))
  ) {
    throw new Error('Invalid trade integer');
  }

  return BigInt(value);
};

export default parseTradeInteger;
