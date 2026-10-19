import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StrKey, Networks, contract } from '@stellar/stellar-sdk';

import Launch from '../../../src/models/Launch';
import AssetIdentity from '../../../src/models/AssetIdentity';
import readContract from '../../../src/services/stellar/readContract';
import type { Configuration } from '../../../src/types/configuration';
import createLaunchReader from '../../../src/services/stellar/createLaunchReader';
import syncAssetIdentities from '../../../src/services/stellar/syncAssetIdentities';
import resolveAssetIdentity from '../../../src/services/stellar/resolveAssetIdentity';

const mocks = vi.hoisted(() => ({ getNetwork: vi.fn() }));

vi.mock('@stellar/stellar-sdk', async (load) => {
  const sdk = await load<Record<string, unknown>>();

  return {
    ...sdk,
    rpc: {
      Server: class {
        getNetwork = mocks.getNetwork;
      },
    },
  };
});

vi.mock('../../../src/models/Launch', () => ({ default: { distinct: vi.fn() } }));
vi.mock('../../../src/models/AssetIdentity', () => ({
  default: { find: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('../../../src/services/stellar/readContract', () => ({ default: vi.fn() }));
vi.mock('../../../src/services/stellar/checkHorizonNetwork', () => ({ default: vi.fn() }));
vi.mock('../../../src/services/stellar/resolveAssetIdentity', () => ({ default: vi.fn() }));

const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));

describe('automatic source for launch reads', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(readContract).mockResolvedValue({ value: 1, ledger: 100 });
    vi.mocked(Launch.distinct).mockResolvedValue([contractId]);
    vi.mocked(AssetIdentity.find).mockReturnValue({ lean: vi.fn().mockResolvedValue([]) } as never);
    vi.mocked(resolveAssetIdentity).mockResolvedValue({ status: 'verified' } as never);
  });

  it.each(['testnet', 'public'] as const)(
    'reads launch data and asset identities on %s without an account lookup',
    async (network) => {
      const networkPassphrase = network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC;

      const configuration = {
        network,
        networkPassphrase,
        factoryContractId: contractId,
        rpcUrl: `https://${network}-rpc.example`,
        horizonUrl: `https://${network}-horizon.example`,
      } as Configuration;

      mocks.getNetwork.mockResolvedValue({ passphrase: networkPassphrase });

      const reader = await createLaunchReader(configuration);

      await reader.launchCount();

      const source = vi.mocked(readContract).mock.calls[0]![1];

      expect(source.accountId()).toBe(contract.NULL_ACCOUNT);
      expect(source.sequenceNumber()).toBe('0');

      await syncAssetIdentities(configuration);

      const assetSource = vi.mocked(resolveAssetIdentity).mock.calls[0]![2];

      expect(assetSource.accountId()).toBe(contract.NULL_ACCOUNT);
      expect(assetSource.sequenceNumber()).toBe('0');
    },
  );
});
