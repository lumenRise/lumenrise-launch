import type { rpc } from '@stellar/stellar-sdk';
import { Address, StrKey, scValToNative } from '@stellar/stellar-sdk';

const decodeLaunchCreation = (
  transaction: rpc.Api.GetTransactionResponse,
  factoryContractId: string,
): string | null => {
  if (transaction.status !== 'SUCCESS' || !transaction.returnValue) {
    return null;
  }

  const envelope = transaction.envelopeXdr;

  const operations =
    envelope.type === 'envelopeTypeTx'
      ? envelope.v1.tx.operations
      : envelope.type === 'envelopeTypeTxFeeBump'
        ? envelope.feeBump.tx.innerTx.v1.tx.operations
        : envelope.v0.tx.operations;

  if (operations.length !== 1 || operations[0]!.body.type !== 'invokeHostFunction') {
    return null;
  }

  const host = operations[0]!.body.invokeHostFunctionOp.hostFunction;

  if (host.type !== 'hostFunctionTypeInvokeContract') {
    return null;
  }

  const call = host.invokeContract;

  if (
    Address.fromScAddress(call.contractAddress).toString() !== factoryContractId ||
    call.functionName.toStringStrict() !== 'create_bonding_curve' ||
    call.args.length !== 1
  ) {
    return null;
  }

  const contractId: unknown = scValToNative(transaction.returnValue);

  return typeof contractId === 'string' && StrKey.isValidContract(contractId) ? contractId : null;
};

export default decodeLaunchCreation;
