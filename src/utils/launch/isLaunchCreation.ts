import { Address, type rpc } from '@stellar/stellar-sdk';

const isLaunchCreation = (
  transaction: Pick<rpc.Api.TransactionInfo, 'status' | 'resultMetaXdr'>,
  contractId: string,
): boolean => {
  if (transaction.status !== 'SUCCESS') {
    return false;
  }

  const meta = transaction.resultMetaXdr;

  if (meta.type !== 'v3' && meta.type !== 'v4') {
    return false;
  }

  const operations = meta.type === 'v3' ? meta.v3.operations : meta.v4.operations;

  for (const operation of operations) {
    for (const change of operation.changes) {
      if (change.type !== 'ledgerEntryCreated' || change.created.data.type !== 'contractData') {
        continue;
      }

      const data = change.created.data.contractData;

      if (
        data.key.type === 'scvLedgerKeyContractInstance' &&
        Address.fromScAddress(data.contract).toString() === contractId
      ) {
        return true;
      }
    }
  }

  return false;
};

export default isLaunchCreation;
