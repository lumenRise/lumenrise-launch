import { Account, contract, type rpc, type xdr } from '@stellar/stellar-sdk';

import readContract from './readContract';
import getNetworkConfig from '../network/getNetworkConfig';
import type { ChainRead } from '../../types/launch/reader';
import type { StellarNetwork } from '../../types/network/configuration';

const readLaunchContract = async (
  server: rpc.Server,
  contractId: string,
  method: string,
  network: StellarNetwork,
  args: xdr.ScVal[] = [],
): Promise<ChainRead<unknown>> => {
  return readContract(
    server,
    new Account(contract.NULL_ACCOUNT, '0'),
    getNetworkConfig(network).networkPassphrase,
    contractId,
    method,
    args,
  );
};

export default readLaunchContract;
