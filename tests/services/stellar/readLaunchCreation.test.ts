import { describe, expect, it, vi } from 'vitest';
import type { rpc, Horizon } from '@stellar/stellar-sdk';
import { StrKey, scValToNative } from '@stellar/stellar-sdk';

import isLaunchCreation from '../../../src/utils/launch/isLaunchCreation';
import createCreationTransaction from '../../helpers/createCreationTransaction';
import readLaunchCreation from '../../../src/services/stellar/readLaunchCreation';

const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));
const otherContractId = StrKey.encodeContract(Buffer.alloc(32, 2));

describe('verified launch creation time', () => {
  it.each(['v3', 'v4'] as const)(
    'recognizes actual instance creation in %s metadata',
    (version) => {
      expect(isLaunchCreation(createCreationTransaction(contractId, version), contractId)).toBe(
        true,
      );
      expect(
        isLaunchCreation(createCreationTransaction(otherContractId, version), contractId),
      ).toBe(false);
    },
  );

  it('does not interpret an update or restoration as creation', () => {
    expect(
      isLaunchCreation(
        createCreationTransaction(contractId, 'v4', 'ledgerEntryUpdated'),
        contractId,
      ),
    ).toBe(false);
    expect(
      isLaunchCreation(
        createCreationTransaction(contractId, 'v4', 'ledgerEntryRestored'),
        contractId,
      ),
    ).toBe(false);
  });

  it('stores transaction time, ledger and hash instead of the scheduled start or observation time', async () => {
    const getContractData = vi.fn().mockResolvedValue({ lastModifiedLedgerSeq: 100 });
    const getTransactions = vi
      .fn()
      .mockResolvedValue({ transactions: [createCreationTransaction(contractId)], cursor: 'next' });

    const server = {
      getContractData,
      getHealth: vi.fn().mockResolvedValue({ oldestLedger: 90, latestLedger: 200 }),
      getTransactions,
    };

    const result = await readLaunchCreation(server as unknown as rpc.Server, contractId);

    expect(result).toEqual({
      createdAt: new Date(1_800_000_000_000),
      creationLedger: 100,
      creationTransactionHash: 'a'.repeat(64),
    });
    expect(scValToNative(getContractData.mock.calls[0]![1])).toEqual(['Config']);
    expect(getTransactions).toHaveBeenCalledWith({ startLedger: 100, pagination: { limit: 200 } });
  });

  it('paginates the candidate ledger and stops when a later ledger is reached', async () => {
    const unrelated = createCreationTransaction(otherContractId);

    const server = {
      getContractData: vi.fn().mockResolvedValue({ lastModifiedLedgerSeq: 100 }),
      getHealth: vi.fn().mockResolvedValue({ oldestLedger: 90, latestLedger: 200 }),
      getTransactions: vi
        .fn()
        .mockResolvedValueOnce({ transactions: Array(200).fill(unrelated), cursor: 'page2' })
        .mockResolvedValueOnce({ transactions: [{ ...unrelated, ledger: 101 }], cursor: 'page3' }),
    };

    expect(await readLaunchCreation(server as unknown as rpc.Server, contractId)).toBeNull();
    expect(server.getTransactions).toHaveBeenCalledTimes(2);
    expect(server.getTransactions).toHaveBeenLastCalledWith({
      pagination: { cursor: 'page2', limit: 200 },
    });
  });

  it('uses Horizon transaction metadata when RPC no longer retains the creation ledger', async () => {
    const transaction = createCreationTransaction(contractId);

    const server = {
      getContractData: vi.fn().mockResolvedValue({ lastModifiedLedgerSeq: 100 }),
      getHealth: vi.fn().mockResolvedValue({ oldestLedger: 150, latestLedger: 200 }),
    };

    const call = vi.fn().mockResolvedValue({
      records: [
        {
          successful: true,
          result_meta_xdr: transaction.resultMetaXdr.toXDR('base64'),
          created_at: '2027-01-15T08:00:00Z',
          hash: transaction.txHash,
        },
      ],
    });

    const horizon = {
      transactions: () => ({ forLedger: () => ({ limit: () => ({ order: () => ({ call }) }) }) }),
    };
    const result = await readLaunchCreation(
      server as unknown as rpc.Server,
      contractId,
      horizon as unknown as Horizon.Server,
    );

    expect(result).toEqual({
      createdAt: new Date('2027-01-15T08:00:00Z'),
      creationLedger: 100,
      creationTransactionHash: transaction.txHash,
    });
  });

  it('leaves the date unknown when historical evidence is unavailable', async () => {
    const server = {
      getContractData: vi.fn().mockResolvedValue({ lastModifiedLedgerSeq: 10 }),
      getHealth: vi.fn().mockResolvedValue({ oldestLedger: 90, latestLedger: 200 }),
      getTransactions: vi.fn(),
    };

    expect(await readLaunchCreation(server as unknown as rpc.Server, contractId)).toBeNull();
    expect(server.getTransactions).not.toHaveBeenCalled();
  });
});
