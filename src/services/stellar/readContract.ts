import {
  BASE_FEE,
  Contract,
  TransactionBuilder,
  rpc,
  scValToNative,
  type Account,
  type xdr,
} from '@stellar/stellar-sdk';

import simulateContractRead from './simulateContractRead';
import type { ChainRead } from '../../types/launch/reader';

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

  const key = `${networkPassphrase}:${contractId}:${method}:${args.map((arg): string => arg.toXDR('base64')).join(':')}`;

  const simulation = await simulateContractRead(
    server,
    transaction,
    key,
    method === 'get_state' || method === 'current_price',
  );

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
