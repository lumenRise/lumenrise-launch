import { afterEach, describe, expect, it, vi } from 'vitest';
import { Account, Address, Contract, Keypair, StrKey, TransactionBuilder, nativeToScVal, rpc } from '@stellar/stellar-sdk';

import type { Configuration } from '../src/types/configuration';
import createLaunchReader from '../src/chain/createLaunchReader';

const passphrase = 'Test SDF Network ; September 2015';
const owner = Keypair.random().publicKey();
const factory = StrKey.encodeContract(Buffer.alloc(32, 1));
const child = StrKey.encodeContract(Buffer.alloc(32, 2));
const params = { owner, starts_at: 1_800_000_000n };
const configuration = {
  network: 'testnet', networkPassphrase: passphrase, factoryContractId: factory,
  observerAddress: owner, rpcUrl: 'https://example.test', dbUri: 'mongodb://localhost:27017',
  dbName: 'test', pollIntervalMs: 5000,
} as Configuration;

describe('launch transaction evidence', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it('accepts a successful factory creation call and decodes its submitted params', async () => {
    const tx = new TransactionBuilder(new Account(owner, '1'), { fee: '100', networkPassphrase: passphrase })
      .addOperation(new Contract(factory).call('create_bonding_curve', nativeToScVal(params)))
      .setTimeout(30).build();
    vi.spyOn(rpc.Server.prototype, 'getNetwork').mockResolvedValue({ passphrase } as never);
    vi.spyOn(rpc.Server.prototype, 'getTransaction').mockResolvedValue({
      status: 'SUCCESS', envelopeXdr: tx.toEnvelope(), returnValue: new Address(child).toScVal(),
    } as never);

    const reader = await createLaunchReader(configuration);
    expect(await reader.launchTransaction('a'.repeat(64))).toEqual({
      status: 'SUCCESS', contractId: child, params: { owner, starts_at: '1800000000' },
    });
  });

  it('rejects a successful call to another factory function', async () => {
    const tx = new TransactionBuilder(new Account(owner, '1'), { fee: '100', networkPassphrase: passphrase })
      .addOperation(new Contract(factory).call('launch_at', nativeToScVal(1)))
      .setTimeout(30).build();
    vi.spyOn(rpc.Server.prototype, 'getNetwork').mockResolvedValue({ passphrase } as never);
    vi.spyOn(rpc.Server.prototype, 'getTransaction').mockResolvedValue({
      status: 'SUCCESS', envelopeXdr: tx.toEnvelope(), returnValue: new Address(child).toScVal(),
    } as never);

    const reader = await createLaunchReader(configuration);
    expect((await reader.launchTransaction('b'.repeat(64))).contractId).toBeNull();
  });
});
