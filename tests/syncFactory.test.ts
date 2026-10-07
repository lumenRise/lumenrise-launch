import { describe, expect, it } from 'vitest';
import { Keypair, StrKey } from '@stellar/stellar-sdk';

import syncFactory from '../src/syncFactory';
import refreshLaunchState from '../src/refreshLaunchState';
import type { Configuration } from '../src/types/configuration';
import type { LaunchData, LaunchReader, LaunchStore } from '../src/types';

const factoryContractId = StrKey.encodeContract(Buffer.alloc(32, 1));
const childContractId = StrKey.encodeContract(Buffer.alloc(32, 2));
const asset = StrKey.encodeContract(Buffer.alloc(32, 3));
const pair = StrKey.encodeContract(Buffer.alloc(32, 4));
const owner = Keypair.random().publicKey();

const configuration: Configuration = {
  network: 'testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  factoryContractId,
  observerAddress: owner,
  rpcUrl: 'https://example.test',
  dbUri: 'mongodb://localhost:27017',
  dbName: 'test',
  pollIntervalMs: 1000,
};

const config = {
  factory: factoryContractId,
  params: { owner, asset, pair, metadata: { name: 'Launch', description: '', logo: '', symbol: 'LAUNCH' } },
  total_supply: 10000000n,
};

const state = {
  sold: 0n,
  quote_reserve: 0n,
  team_claimed: 0n,
  buyer_count: 0,
  graduated: false,
  busy: false,
};

describe('syncFactory', () => {
  it('retries a failed save without advancing the cursor and does not duplicate a launch', async () => {
    let nextIndex = 1;
    let failOnce = true;
    const saved = new Map<number, LaunchData>();

    const reader: LaunchReader = {
      launchCount: async () => ({ value: 1, ledger: 100 }),
      launchAt: async () => ({ value: childContractId, ledger: 100 }),
      launchConfig: async () => ({ value: config, ledger: 101 }),
      launchState: async () => ({ value: state, ledger: 102 }),
    };

    const store: LaunchStore = {
      nextIndex: async () => nextIndex,
      save: async (launch) => {
        if (failOnce) {
          failOnce = false;
          throw new Error('temporary database error');
        }
        saved.set(launch.factoryIndex, launch);
      },
      advance: async (index) => {
        nextIndex = index;
      },
      nextStateIndex: async () => 1,
      refreshState: async () => {},
      advanceState: async () => {},
    };

    await expect(syncFactory(reader, store, configuration)).rejects.toThrow('temporary database error');
    expect(nextIndex).toBe(1);
    expect(await syncFactory(reader, store, configuration)).toBe(1);
    expect(await syncFactory(reader, store, configuration)).toBe(0);
    expect(saved.size).toBe(1);
    expect(saved.get(1)?.config.total_supply).toBe('10000000');
    expect(saved.get(1)?.state.sold).toBe('0');
    expect(nextIndex).toBe(2);
  });

  it('rejects a child whose config belongs to another factory', async () => {
    const reader: LaunchReader = {
      launchCount: async () => ({ value: 1, ledger: 100 }),
      launchAt: async () => ({ value: childContractId, ledger: 100 }),
      launchConfig: async () => ({ value: { ...config, factory: asset }, ledger: 101 }),
      launchState: async () => ({ value: state, ledger: 102 }),
    };

    const store: LaunchStore = {
      nextIndex: async () => 1,
      save: async () => {
        throw new Error('must not save');
      },
      advance: async () => {
        throw new Error('must not advance');
      },
      nextStateIndex: async () => 1,
      refreshState: async () => {
        throw new Error('must not refresh');
      },
      advanceState: async () => {
        throw new Error('must not advance');
      },
    };

    await expect(syncFactory(reader, store, configuration)).rejects.toThrow('Invalid on-chain launch config');
  });

  it('refreshes one launch state and only then advances its refresh cursor', async () => {
    let nextStateIndex = 1;
    let savedState: Record<string, unknown> | null = null;

    const reader: LaunchReader = {
      launchCount: async () => ({ value: 1, ledger: 110 }),
      launchAt: async () => ({ value: childContractId, ledger: 110 }),
      launchConfig: async () => ({ value: config, ledger: 110 }),
      launchState: async () => ({ value: { ...state, sold: 100n }, ledger: 111 }),
    };

    const store: LaunchStore = {
      nextIndex: async () => 2,
      save: async () => {},
      advance: async () => {},
      nextStateIndex: async () => nextStateIndex,
      refreshState: async (_index, value) => {
        savedState = value;
      },
      advanceState: async (index) => {
        expect(savedState).not.toBeNull();
        nextStateIndex = index;
      },
    };

    await refreshLaunchState(reader, store);

    expect(savedState).toMatchObject({ sold: '100' });
    expect(nextStateIndex).toBe(1);
  });
});
