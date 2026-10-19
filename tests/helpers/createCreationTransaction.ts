import { Address, rpc, xdr } from '@stellar/stellar-sdk';

const createCreationTransaction = (
  contractId: string,
  version: 'v3' | 'v4' = 'v4',
  changeType = 'ledgerEntryCreated',
): rpc.Api.TransactionInfo => {
  const entry = new xdr.LedgerEntry({
    lastModifiedLedgerSeq: 100,
    ext: xdr.LedgerEntryExt.v0(),
    data: xdr.LedgerEntryData.contractData(
      new xdr.ContractDataEntry({
        ext: xdr.ExtensionPoint.v0(),
        contract: new Address(contractId).toScAddress(),
        key: xdr.ScVal.scvLedgerKeyContractInstance(),
        durability: xdr.ContractDataDurability.persistent,
        val: xdr.ScVal.scvVoid(),
      }),
    ),
  });

  const change =
    changeType === 'ledgerEntryUpdated'
      ? xdr.LedgerEntryChange.ledgerEntryUpdated(entry)
      : changeType === 'ledgerEntryRestored'
        ? xdr.LedgerEntryChange.ledgerEntryRestored(entry)
        : xdr.LedgerEntryChange.ledgerEntryCreated(entry);

  const common = {
    ext: xdr.ExtensionPoint.v0(),
    txChangesBefore: [],
    txChangesAfter: [],
    sorobanMeta: null,
  };

  const meta =
    version === 'v3'
      ? xdr.TransactionMeta.v3(
          new xdr.TransactionMetaV3({
            ...common,
            operations: [new xdr.OperationMeta({ changes: [change] })],
          }),
        )
      : xdr.TransactionMeta.v4(
          new xdr.TransactionMetaV4({
            ...common,
            operations: [
              new xdr.OperationMetaV2({
                ext: xdr.ExtensionPoint.v0(),
                changes: [change],
                events: [],
              }),
            ],
            events: [],
            diagnosticEvents: [],
          }),
        );

  return {
    status: rpc.Api.GetTransactionStatus.SUCCESS,
    ledger: 100,
    createdAt: 1_800_000_000,
    txHash: 'a'.repeat(64),
    resultMetaXdr: meta,
  } as rpc.Api.TransactionInfo;
};

export default createCreationTransaction;
