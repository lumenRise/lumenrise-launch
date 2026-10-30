import { Account, Address, Horizon, rpc, contract, nativeToScVal } from '@stellar/stellar-sdk';

import readContract from './readContract';
import readLaunchCreation from './readLaunchCreation';
import type { LaunchReader } from '../../types/launch/reader';
import type { Configuration } from '../../types/configuration';
import type { HolderBalanceReader } from '../../types/launch/holder';

const createLaunchReader = async (
  configuration: Configuration,
): Promise<LaunchReader & HolderBalanceReader> => {
  const server = new rpc.Server(configuration.rpcUrl, {
    allowHttp: configuration.rpcUrl.startsWith('http:'),
    timeout: 15_000,
  });

  const horizon = new Horizon.Server(configuration.horizonUrl);
  const remote = await server.getNetwork();

  if (remote.passphrase !== configuration.networkPassphrase) {
    throw new Error('Stellar launch RPC network mismatch');
  }

  const getSource = () => new Account(contract.NULL_ACCOUNT, '0');

  return {
    network: configuration.network,
    launchCreation: async (contractId: string) =>
      readLaunchCreation(server, contractId, horizon, configuration.networkPassphrase),
    tokenBalance: async (asset, address) => {
      const read = await readContract(
        server,
        getSource(),
        configuration.networkPassphrase,
        asset,
        'balance',
        [new Address(address).toScVal()],
      );

      return read.value;
    },
    launchCount: async () => {
      const source = getSource();

      const read = await readContract(
        server,
        source,
        configuration.networkPassphrase,
        configuration.factoryContractId,
        'launch_count',
      );

      if (typeof read.value !== 'number' || !Number.isInteger(read.value) || read.value < 0) {
        throw new Error('Factory returned an invalid launch count');
      }

      return {
        network: configuration.network,
        value: read.value,
        ledger: read.ledger,
      };
    },

    launchAt: async (index) => {
      const source = getSource();

      const read = await readContract(
        server,
        source,
        configuration.networkPassphrase,
        configuration.factoryContractId,
        'launch_at',
        [nativeToScVal(index, { type: 'u32' })],
      );

      if (read.value !== null && typeof read.value !== 'string') {
        throw new Error(`Factory returned an invalid launch address at ${index}`);
      }

      return {
        network: configuration.network,
        value: read.value,
        ledger: read.ledger,
      };
    },

    launchConfig: async (contractId) => {
      const source = getSource();

      return readContract(
        server,
        source,
        configuration.networkPassphrase,
        contractId,
        'get_config',
      );
    },

    launchPrice: async (contractId) => {
      const source = getSource();

      return readContract(
        server,
        source,
        configuration.networkPassphrase,
        contractId,
        'current_price',
      );
    },

    launchState: async (contractId) => {
      const source = getSource();

      return readContract(server, source, configuration.networkPassphrase, contractId, 'get_state');
    },
  };
};

export default createLaunchReader;
