import {
  rpc,
  StrKey,
  Address,
  scValToNative,
  nativeToScVal,
} from '@stellar/stellar-sdk';

import readContract from './readContract';
import toPlainValue from './toPlainValue';
import type { LaunchReader } from '../types/launch';
import type { Configuration } from '../types/configuration';

const createLaunchReader = async (
  configuration: Configuration,
): Promise<LaunchReader> => {
  const server = new rpc.Server(configuration.rpcUrl, {
    allowHttp: configuration.rpcUrl.startsWith('http:'),
    timeout: 15_000,
  });

  const network = await server.getNetwork();

  if (network.passphrase !== configuration.networkPassphrase) {
    throw new Error('Stellar RPC network does not match STELLAR_AUTH_NETWORK');
  }

  let cachedSource: Awaited<ReturnType<typeof server.getAccount>> | undefined;
  let sourceExpiresAt = 0;

  const getSource = async () => {
    if (!cachedSource || Date.now() >= sourceExpiresAt) {
      cachedSource = await server.getAccount(configuration.observerAddress);
      sourceExpiresAt = Date.now() + 30_000;
    }
    return cachedSource;
  };

  return {
    launchTransaction: async (hash) => {
      const result = await server.getTransaction(hash);

      if (result.status === 'FAILED') {
        return { status: 'FAILED', contractId: null, params: null };
      }

      if (result.status !== 'SUCCESS') {
        return { status: 'PENDING', contractId: null, params: null };
      }

      const envelope = result.envelopeXdr;

      const operations =
        envelope.type === 'envelopeTypeTx'
          ? envelope.v1.tx.operations
          : envelope.type === 'envelopeTypeTxFeeBump'
            ? envelope.feeBump.tx.innerTx.v1.tx.operations
            : envelope.v0.tx.operations;

      const factoryCalls = operations.filter((operation) => {
        if (operation.body.type !== 'invokeHostFunction') {
          return false;
        }

        const host = operation.body.invokeHostFunctionOp.hostFunction;

        if (host.type !== 'hostFunctionTypeInvokeContract') {
          return false;
        }

        const call = host.invokeContract;

        return (
          Address.fromScAddress(call.contractAddress).toString() ===
            configuration.factoryContractId &&
          call.functionName.toStringStrict() === 'create_bonding_curve' &&
          call.args.length === 1
        );
      });

      const address: unknown = result.returnValue
        ? scValToNative(result.returnValue)
        : null;

      const operation = factoryCalls.length === 1 ? factoryCalls[0] : null;

      const host =
        operation?.body.type === 'invokeHostFunction'
          ? operation.body.invokeHostFunctionOp.hostFunction
          : null;

      return {
        status: 'SUCCESS',
        contractId:
          operation &&
          typeof address === 'string' &&
          StrKey.isValidContract(address)
            ? address
            : null,
        params:
          host?.type === 'hostFunctionTypeInvokeContract'
            ? toPlainValue(scValToNative(host.invokeContract.args[0]!))
            : null,
      };
    },
    launchCount: async () => {
      const source = await getSource();
      const read = await readContract(
        server,
        source,
        configuration.networkPassphrase,
        configuration.factoryContractId,
        'launch_count',
      );

      if (
        typeof read.value !== 'number' ||
        !Number.isInteger(read.value) ||
        read.value < 0
      ) {
        throw new Error('Factory returned an invalid launch count');
      }

      return { value: read.value, ledger: read.ledger };
    },

    launchAt: async (index) => {
      const source = await getSource();
      const read = await readContract(
        server,
        source,
        configuration.networkPassphrase,
        configuration.factoryContractId,
        'launch_at',
        [nativeToScVal(index, { type: 'u32' })],
      );

      if (read.value !== null && typeof read.value !== 'string') {
        throw new Error(
          `Factory returned an invalid launch address at ${index}`,
        );
      }

      return { value: read.value, ledger: read.ledger };
    },

    launchConfig: async (contractId) => {
      const source = await getSource();

      return readContract(
        server,
        source,
        configuration.networkPassphrase,
        contractId,
        'get_config',
      );
    },

    launchState: async (contractId) => {
      const source = await getSource();

      return readContract(
        server,
        source,
        configuration.networkPassphrase,
        contractId,
        'get_state',
      );
    },
  };
};

export default createLaunchReader;
