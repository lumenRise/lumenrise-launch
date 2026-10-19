import { describe, expect, it } from 'vitest';
import { Networks } from '@stellar/stellar-sdk';

import validateNetworkConfiguration from '../../src/services/network/validateNetworkConfiguration';

const configuration = {
  network: 'public' as const,
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: Networks.PUBLIC,
  factoryContractId: '',
};

describe('provider configuration validation', () => {
  it('accepts testnet provider URLs under public configuration', (): void => {
    expect(() => validateNetworkConfiguration(configuration)).not.toThrow();
  });

  it('still rejects malformed or insecure provider URLs', (): void => {
    expect(() => validateNetworkConfiguration({
      ...configuration,
      rpcUrl: 'invalid',
    })).toThrow();

    expect(() => validateNetworkConfiguration({
      ...configuration,
      rpcUrl: 'http://soroban-testnet.stellar.org',
    })).toThrow('Invalid public provider URL');
  });
});
