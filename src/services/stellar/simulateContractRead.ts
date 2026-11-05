import type { rpc, Transaction, FeeBumpTransaction } from '@stellar/stellar-sdk';

const pending = new WeakMap<
  rpc.Server,
  Map<string, Promise<rpc.Api.SimulateTransactionResponse>>
>();

const simulateContractRead = async (
  server: rpc.Server,
  transaction: Transaction | FeeBumpTransaction,
  key: string,
  share: boolean,
): Promise<rpc.Api.SimulateTransactionResponse> => {
  if (!share) {
    return server.simulateTransaction(transaction);
  }

  const reads =
    pending.get(server) ?? new Map<string, Promise<rpc.Api.SimulateTransactionResponse>>();

  const existing = reads.get(key);

  if (existing) {
    return existing;
  }

  const read = server.simulateTransaction(transaction);

  reads.set(key, read);

  pending.set(server, reads);

  try {
    return await read;
  } finally {
    if (reads.get(key) === read) {
      reads.delete(key);
    }
  }
};

export default simulateContractRead;
