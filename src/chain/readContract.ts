import {
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
  type Account,
  type xdr,
} from '@stellar/stellar-sdk';

import type { ChainRead } from '../types/launch';

const readContract = async (
  server: rpc.Server,
  source: Account,
  networkPassphrase: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<ChainRead<unknown>> => {
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase,
  })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();

  const simulation = await server.simulateTransaction(transaction);

  if (
    !rpc.Api.isSimulationSuccess(simulation) ||
    !simulation.result ||
    'restorePreamble' in simulation
  ) {
    throw new Error(`Unable to read ${method} from ${contractId}`);
  }

  return {
    value: scValToNative(simulation.result.retval),
    ledger: simulation.latestLedger,
  };
};

export default readContract;
