import { describe, expect, it } from 'vitest';
import { Keypair, StrKey } from '@stellar/stellar-sdk';

import parseLaunchConfig from '../../../src/utils/launch/parseLaunchConfig';

const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));

const input = {
  network: 'testnet' as const,
  factoryContractId: contractId,
  factoryIndex: 1,
  contractId,
  asOfLedger: 10,
  stateAsOfLedger: 10,
  rawConfig: {
    factory: contractId,
    total_supply: '100',
    params: {
      owner: Keypair.random().publicKey(),
      asset: contractId,
      pair: contractId,
      metadata: { name: 'Project', symbol: 'PRJ', logo: 'https://images.example/logo.png' },
    },
  },
  rawState: { sold: '0', quote_reserve: '0', team_claimed: '0', buyer_count: 0, graduated: false },
};

describe('contract launch description', () => {
  it.each([undefined, 'Project', 42])('ignores the contract description: %j', (description: string | number | undefined): void => {
    const parsed = parseLaunchConfig({
      ...input,
      rawConfig: {
        ...input.rawConfig,
        params: {
          ...input.rawConfig.params,
          metadata: { ...input.rawConfig.params.metadata, description },
        },
      },
    });

    expect(parsed.metadata.description).toBe('');
    expect(parsed.metadata.name).toBe('Project');
  });
});
