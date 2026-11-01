import { expect, it } from 'vitest';

import getBasePoolPrice from '../../src/services/base/getBasePoolPrice';

it('returns raw quote units per whole asset for both token orders without floating point', (): void => {
  const sqrt = 2n * (1n << 96n);

  expect(getBasePoolPrice(sqrt, true, 18)).toBe(4n * 10n ** 18n);
  expect(getBasePoolPrice(sqrt, false, 6)).toBe(250000n);
  expect(getBasePoolPrice(1n << 96n, true, 6)).toBe(1000000n);
});

it('preserves precision above the safe integer range and rounds tiny prices up', (): void => {
  const sqrt = 79228162514264337593543950336n + 123456789n;
  const numerator = sqrt * sqrt * 10n ** 18n;
  const denominator = 1n << 192n;

  expect(getBasePoolPrice(sqrt, true, 18)).toBe((numerator + denominator - 1n) / denominator);
  expect(getBasePoolPrice(1n, true, 18)).toBe(1n);
  expect(() => getBasePoolPrice(0n, true, 18)).toThrow();
  expect(() => getBasePoolPrice(1n, false, 19)).toThrow();
});
