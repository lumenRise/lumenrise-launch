import type { rpc } from '@stellar/stellar-sdk';
import type { Account } from '@stellar/stellar-sdk';

import readContract from './readContract';
import findAssetIssuer from './findAssetIssuer';
import type { Configuration } from '../types/configuration';
import type { AssetIdentityRecord } from '../types/assetIdentity';

const resolveAssetIdentity = async (
  contractId: string,
  server: rpc.Server,
  source: Account,
  configuration: Configuration,
): Promise<AssetIdentityRecord> => {
  const result: AssetIdentityRecord = {
    network: configuration.network,
    assetContractId: contractId,
    status: 'unverified',
    assetCode: null,
    issuer: null,
    reason: null,
    identityCheckedAt: new Date(),
  };

  try {
    const instance = await server.getContractInstance(contractId);

    if (instance.executable.type !== 'contractExecutableStellarAsset') {
      return {
        ...result,
        reason: 'Contract executable is not a Stellar Asset Contract',
      };
    }

    const read = await readContract(
      server,
      source,
      configuration.networkPassphrase,
      contractId,
      'symbol',
    );
    const code = read.value;

    if (typeof code !== 'string' || !/^[A-Za-z0-9]{1,12}$/.test(code)) {
      return {
        ...result,
        reason: 'SAC symbol is not a classic issued asset code',
      };
    }

    const issuer = await findAssetIssuer(code, contractId, configuration);

    if (!issuer) {
      return {
        ...result,
        reason: 'No matching issuer found in Horizon asset candidates',
      };
    }

    return { ...result, status: 'verified', assetCode: code, issuer };
  } catch {
    return {
      ...result,
      status: 'unavailable',
      reason: 'Chain or asset discovery is temporarily unavailable',
    };
  }
};

export default resolveAssetIdentity;
