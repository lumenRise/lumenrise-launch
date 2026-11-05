import { Networks } from '@stellar/stellar-sdk';
import { describe, expect, it, vi } from 'vitest';

import getNetworkConfig from '../../src/services/network/getNetworkConfig';

vi.mock('../../src/env', () => ({
  default: {
    STELLAR_TESTNET_RPC_URL: 'https://test-rpc.example',
    STELLAR_TESTNET_HORIZON_URL: 'https://test-horizon.example',
    STELLAR_TESTNET_HOME_DOMAIN: 'test.example',
    STELLAR_TESTNET_TOML_DIRNAME: '/tmp/testnet',
    STELLAR_TESTNET_TOML_FILENAME: 'stellar.toml',
    LAUNCH_TESTNET_FACTORY_CONTRACT_ID: 'test-factory',
    STELLAR_PUBLIC_RPC_URL: 'https://public-rpc.example',
    STELLAR_PUBLIC_HORIZON_URL: 'https://public-horizon.example',
    STELLAR_PUBLIC_HOME_DOMAIN: 'public.example',
    STELLAR_PUBLIC_TOML_DIRNAME: '/tmp/public',
    STELLAR_PUBLIC_TOML_FILENAME: 'stellar.toml',
    LAUNCH_PUBLIC_FACTORY_CONTRACT_ID: 'public-factory',
  },
}));

describe('network configuration isolation', () => {
  it('selects every chain setting independently without changing global state', async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, index) =>
        Promise.resolve(getNetworkConfig(index % 2 === 0 ? 'testnet' : 'public')),
      ),
    );

    for (const [index, configuration] of results.entries()) {
      const prefix = index % 2 === 0 ? 'test' : 'public';

      expect(configuration).toMatchObject({
        rpcUrl: `https://${prefix}-rpc.example`,
        horizonUrl: `https://${prefix}-horizon.example`,
        factoryContractId: `${prefix}-factory`,
        homeDomain: `${prefix}.example`,
        networkPassphrase: index % 2 === 0 ? Networks.TESTNET : Networks.PUBLIC,
        tomlPath: index % 2 === 0 ? '/tmp/testnet/stellar.toml' : '/tmp/public/stellar.toml',
      });
    }
  });
});
