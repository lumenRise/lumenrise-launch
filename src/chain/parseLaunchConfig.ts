import { StrKey } from '@stellar/stellar-sdk';

import toPlainValue from './toPlainValue';
import type { LaunchData } from '../types';
import parseLaunchState from './parseLaunchState';

interface LaunchConfigInput {
  rawConfig: unknown;
  rawState: unknown;
  network: LaunchData['network'];
  factoryContractId: string;
  factoryIndex: number;
  contractId: string;
  asOfLedger: number;
  stateAsOfLedger: number;
}

const parseLaunchConfig = (input: LaunchConfigInput): LaunchData => {
  const { rawConfig, rawState, network, factoryContractId, factoryIndex, contractId, asOfLedger, stateAsOfLedger } = input;
  const config = toPlainValue(rawConfig);

  if (config === null || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('Launch config is not a struct');
  }

  const fields = config as Record<string, unknown>;
  const params = fields.params;

  if (params === null || typeof params !== 'object' || Array.isArray(params)) {
    throw new Error('Launch config is missing params');
  }

  const launchParams = params as Record<string, unknown>;
  const metadata = launchParams.metadata;

  if (metadata === null || typeof metadata !== 'object' || Array.isArray(metadata)) {
    throw new Error('Launch config is missing metadata');
  }

  const display = metadata as Record<string, unknown>;

  if (fields.factory !== factoryContractId) {
    throw new Error(`Invalid on-chain launch config at factory index ${factoryIndex}`);
  }

  if (typeof fields.total_supply !== 'string' || !/^\d+$/.test(fields.total_supply)) {
    throw new Error('Launch config has invalid total supply');
  }

  if (typeof launchParams.owner !== 'string') {
    throw new Error('Launch config has invalid owner');
  }

  if (!StrKey.isValidEd25519PublicKey(launchParams.owner) && !StrKey.isValidContract(launchParams.owner)) {
    throw new Error('Launch config has invalid owner');
  }

  if (typeof launchParams.asset !== 'string' || !StrKey.isValidContract(launchParams.asset)) {
    throw new Error('Launch config has invalid asset');
  }

  if (typeof launchParams.pair !== 'string' || !StrKey.isValidContract(launchParams.pair)) {
    throw new Error('Launch config has invalid pair');
  }

  if (typeof display.name !== 'string' || typeof display.symbol !== 'string') {
    throw new Error('Launch config has invalid metadata');
  }

  if (typeof display.description !== 'string' || typeof display.logo !== 'string') {
    throw new Error('Launch config has invalid metadata');
  }

  return {
    network,
    factoryContractId,
    factoryIndex,
    contractId,
    owner: launchParams.owner,
    asset: launchParams.asset,
    pair: launchParams.pair,
    metadata: {
      name: display.name,
      description: display.description,
      logo: display.logo,
      symbol: display.symbol,
    },
    config: fields,
    state: parseLaunchState(rawState),
    asOfLedger,
    observedAt: new Date(),
    stateAsOfLedger,
    stateObservedAt: new Date(),
  };
};

export default parseLaunchConfig;
