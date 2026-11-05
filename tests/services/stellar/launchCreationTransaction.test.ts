import { expect, it } from 'vitest';
import { StrKey } from '@stellar/stellar-sdk';

import decodeLaunchCreation from '../../../src/utils/launch/decodeLaunchCreation';
import createStellarLaunchTransaction from '../../helpers/createStellarLaunchTransaction';
import deriveStellarLaunchAddress from '../../../src/utils/launch/deriveStellarLaunchAddress';

const factory = StrKey.encodeContract(Buffer.alloc(32, 1));
const child = StrKey.encodeContract(Buffer.alloc(32, 2));

it.each([false, true])(
  'decodes a confirmed direct factory creation including fee bumps: %s',
  (feeBump: boolean): void => {
    expect(
      decodeLaunchCreation(createStellarLaunchTransaction(factory, child, feeBump), factory),
    ).toBe(child);
  },
);

it('rejects other factories and methods', (): void => {
  expect(decodeLaunchCreation(createStellarLaunchTransaction(factory, child), child)).toBeNull();

  expect(
    decodeLaunchCreation(
      createStellarLaunchTransaction(factory, child, false, 'launch_at'),
      factory,
    ),
  ).toBeNull();
});

it('matches the deployed factory salt and address derivation', (): void => {
  expect(
    deriveStellarLaunchAddress(
      'CDG76JM6I67SGIV5ZN4WK6DW54ZUWPL6BMXD234ULWIERXRRYJ5QVDZC',
      11,
      'Test SDF Network ; September 2015',
    ),
  ).toBe('CD6TVV2JISPIIKZLSMPWSMZD6CVBUIWSF7STZMXYTFKGJQWRF5EGY2CM');
});
