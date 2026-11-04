import type { rpc } from '@stellar/stellar-sdk';
import {
  Account,
  Address,
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
} from '@stellar/stellar-sdk';

const createStellarLaunchTransaction = (
  factory: string,
  child: string,
  feeBump: boolean = false,
  method: string = 'create_bonding_curve',
): rpc.Api.GetSuccessfulTransactionResponse => {
  const signer = Keypair.random().publicKey();

  const inner = new TransactionBuilder(new Account(signer, '1'), {
    fee: '100',
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(new Contract(factory).call(method, nativeToScVal({})))
    .setTimeout(30)
    .build();

  const transaction = feeBump
    ? TransactionBuilder.buildFeeBumpTransaction(signer, '100', inner, Networks.TESTNET)
    : inner;

  return {
    status: 'SUCCESS',
    txHash: 'a'.repeat(64),
    ledger: 100,
    createdAt: 1_800_000_000,
    applicationOrder: 1,
    envelopeXdr: transaction.toEnvelope(),
    returnValue: new Address(child).toScVal(),
  } as rpc.Api.GetSuccessfulTransactionResponse;
};

export default createStellarLaunchTransaction;
