import type { rpc } from '@stellar/stellar-sdk';
import { describe, expect, it, vi } from 'vitest';
import { StrKey, Networks, contract, nativeToScVal } from '@stellar/stellar-sdk';

import readLaunchContract from '../../../src/services/stellar/readLaunchContract';

vi.mock('../../../src/services/network/getNetworkConfig', () => ({
  default: (network: string) => ({
    networkPassphrase: network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC,
  }),
}));

const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));

describe('automatic source for contract reads', () => {
  it.each(['testnet', 'public'] as const)(
    'uses the SDK null account on %s without loading or funding an account',
    async (network) => {
      const simulateTransaction = vi.fn().mockResolvedValue({
        transactionData: {},
        result: { retval: nativeToScVal(42, { type: 'u32' }) },
        latestLedger: 100,
      });

      const result = await readLaunchContract(
        { simulateTransaction } as unknown as rpc.Server,
        contractId,
        'current_price',
        network,
      );

      const transaction = simulateTransaction.mock.calls[0]![0];

      expect(transaction.source).toBe(contract.NULL_ACCOUNT);

      expect(transaction.sequence).toBe('1');

      expect(transaction.networkPassphrase).toBe(
        network === 'testnet' ? Networks.TESTNET : Networks.PUBLIC,
      );

      expect(transaction.signatures).toHaveLength(0);

      expect(result).toEqual({ value: 42, ledger: 100 });
    },
  );
});
