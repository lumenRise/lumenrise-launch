import { beforeEach, expect, it, vi } from 'vitest';
import { Keypair, StrKey, Networks } from '@stellar/stellar-sdk';

import Launch from '../../../src/models/Launch';
import claimLaunchName from '../../../src/services/launch/claimLaunchName';
import getNetworkConfig from '../../../src/services/network/getNetworkConfig';
import readLaunchContract from '../../../src/services/stellar/readLaunchContract';
import recordStellarLaunch from '../../../src/services/launch/recordStellarLaunch';
import resolveLaunchMetadata from '../../../src/services/launch/resolveLaunchMetadata';
import createStellarLaunchTransaction from '../../helpers/createStellarLaunchTransaction';
import deriveStellarLaunchAddress from '../../../src/utils/launch/deriveStellarLaunchAddress';

vi.mock('../../../src/logger', () => ({ default: { info: vi.fn() } }));

vi.mock('../../../src/models/Launch', () => ({
  default: { findOne: vi.fn(), updateOne: vi.fn(), exists: vi.fn() },
}));

vi.mock('../../../src/services/launch/claimLaunchName', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/stellar/readLaunchContract', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/launch/resolveLaunchMetadata', () => ({ default: vi.fn() }));

vi.mock('../../../src/services/network/getNetworkConfig', () => ({ default: vi.fn() }));

const factory = StrKey.encodeContract(Buffer.alloc(32, 1));
const child = deriveStellarLaunchAddress(factory, 2, Networks.TESTNET);
const owner = Keypair.random().publicKey();
const transaction = createStellarLaunchTransaction(factory, child);

const metadata = {
  name: 'Blue Project',
  symbol: 'BLUE',
  description: '',
  logo: 'https://images.example/blue.png',
};

beforeEach((): void => {
  vi.resetAllMocks();

  vi.mocked(getNetworkConfig).mockReturnValue({
    factoryContractId: factory,
    networkPassphrase: Networks.TESTNET,
  } as never);

  vi.mocked(Launch.findOne)
    .mockReturnValueOnce({ lean: async () => null } as never)
    .mockReturnValue({ lean: async () => ({ contractId: child }) } as never);

  vi.mocked(claimLaunchName).mockResolvedValue('blue-project');

  vi.mocked(resolveLaunchMetadata).mockResolvedValue(metadata);

  vi.mocked(Launch.updateOne).mockResolvedValue({ upsertedCount: 1 } as never);

  vi.mocked(readLaunchContract).mockImplementation(async (_server, _contractId, method) => {
    if (method === 'launch_count') {
      return { value: 3, ledger: 101 };
    }

    if (method === 'launch_at') {
      return { value: child, ledger: 101 };
    }

    if (method === 'get_state') {
      return {
        value: { sold: 0n, quote_reserve: 0n, team_claimed: 0n, buyer_count: 0, graduated: false },
        ledger: 102,
      };
    }

    return {
      value: {
        factory,
        total_supply: 10000000n,
        params: {
          owner,
          asset: StrKey.encodeContract(Buffer.alloc(32, 3)),
          pair: StrKey.encodeContract(Buffer.alloc(32, 4)),
          metadata,
        },
      },
      ledger: 101,
    };
  });
});

it('resolves the actual factory index, verifies registration and inserts using the scanner identity', async (): Promise<void> => {
  const saved = await recordStellarLaunch({} as never, 'testnet', child, transaction);

  expect(saved.contractId).toBe(child);

  expect(readLaunchContract).toHaveBeenCalledWith(
    expect.anything(),
    factory,
    'launch_at',
    'testnet',
    expect.any(Array),
  );

  expect(Launch.updateOne).toHaveBeenCalledWith(
    { chain: 'stellar', network: 'testnet', contractId: child },
    expect.objectContaining({
      $setOnInsert: expect.objectContaining({
        factoryContractId: factory,
        factoryIndex: 2,
        slug: 'blue-project',
      }),
      $set: expect.objectContaining({
        creationTransactionHash: transaction.txHash,
        creationLedger: transaction.ledger,
      }),
    }),
    { upsert: true },
  );
});

it('rejects a registry mismatch before reserving a name or writing a launch', async (): Promise<void> => {
  vi.mocked(readLaunchContract)
    .mockResolvedValueOnce({ value: 3, ledger: 101 })
    .mockResolvedValueOnce({ value: factory, ledger: 101 });

  await expect(recordStellarLaunch({} as never, 'testnet', child, transaction)).rejects.toThrow(
    'not registered',
  );

  expect(claimLaunchName).not.toHaveBeenCalled();

  expect(Launch.updateOne).not.toHaveBeenCalled();
});

it('accepts a concurrent scanner insert only when the persisted launch identity matches', async (): Promise<void> => {
  vi.mocked(Launch.updateOne).mockRejectedValue({ code: 11000 });

  vi.mocked(Launch.exists).mockResolvedValue({ _id: 'launch' } as never);

  await expect(
    recordStellarLaunch({} as never, 'testnet', child, transaction),
  ).resolves.toMatchObject({ contractId: child });

  expect(Launch.exists).toHaveBeenCalledWith({
    chain: 'stellar',
    network: 'testnet',
    contractId: child,
    factoryContractId: factory,
    factoryIndex: 2,
  });
});
