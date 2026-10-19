import { xdr, nativeToScVal, rpc, type Horizon } from '@stellar/stellar-sdk';

import type { LaunchCreation } from '../../types/launch/creation';
import isLaunchCreation from '../../utils/launch/isLaunchCreation';

const readLaunchCreation = async (
  server: rpc.Server,
  contractId: string,
  horizon?: Horizon.Server,
): Promise<LaunchCreation | null> => {
  const entry = await server.getContractData(
    contractId,
    xdr.ScVal.scvVec([nativeToScVal('Config', { type: 'symbol' })]),
  );

  const ledger = entry.lastModifiedLedgerSeq;

  if (!ledger) {
    return null;
  }

  const health = await server.getHealth();

  if (ledger < health.oldestLedger) {
    if (!horizon) {
      return null;
    }

    let page = await horizon.transactions().forLedger(ledger).limit(200).order('asc').call();

    while (true) {
      for (const transaction of page.records) {
        if (!transaction.successful || !transaction.result_meta_xdr) {
          continue;
        }

        const meta = xdr.TransactionMeta.fromXDR(transaction.result_meta_xdr, 'base64');

        if (
          isLaunchCreation(
            { status: rpc.Api.GetTransactionStatus.SUCCESS, resultMetaXdr: meta },
            contractId,
          )
        ) {
          return {
            createdAt: new Date(transaction.created_at),
            creationLedger: ledger,
            creationTransactionHash: transaction.hash,
          };
        }
      }

      if (page.records.length < 200) {
        return null;
      }

      page = await page.next();
    }
  }

  if (ledger > health.latestLedger) {
    return null;
  }

  let cursor: string | undefined;

  while (true) {
    const page = await server.getTransactions(
      cursor
        ? { pagination: { cursor, limit: 200 } }
        : { startLedger: ledger, pagination: { limit: 200 } },
    );

    for (const transaction of page.transactions) {
      if (transaction.ledger > ledger) {
        return null;
      }

      if (isLaunchCreation(transaction, contractId)) {
        return {
          createdAt: new Date(transaction.createdAt * 1000),
          creationLedger: ledger,
          creationTransactionHash: transaction.txHash,
        };
      }
    }

    if (page.transactions.length < 200 || page.cursor === cursor) {
      return null;
    }

    cursor = page.cursor;
  }
};

export default readLaunchCreation;
