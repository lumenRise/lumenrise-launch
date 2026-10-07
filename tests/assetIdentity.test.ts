import { afterEach, describe, expect, it, vi } from 'vitest';
import { Asset, Keypair, Networks, StrKey } from '@stellar/stellar-sdk';

import findAssetIssuer from '../src/chain/findAssetIssuer';
import type { Configuration } from '../src/types/configuration';
import resolveAssetIdentity from '../src/chain/resolveAssetIdentity';

vi.mock('../src/chain/readContract', () => ({
  default: vi.fn().mockResolvedValue({ value: 'TEST', ledger: 100 }),
}));

const issuer = Keypair.random().publicKey();
const contractId = new Asset('TEST', issuer).contractId(Networks.TESTNET);
const configuration = {
  network: 'testnet',
  networkPassphrase: Networks.TESTNET,
  horizonUrl: 'https://horizon-testnet.stellar.org',
} as Configuration;

describe('SAC asset identity', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('accepts an issuer only when its deterministic SAC ID matches the on-chain contract', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ _embedded: { records: [
        { asset_code: 'TEST', asset_issuer: Keypair.random().publicKey() },
        { asset_code: 'TEST', asset_issuer: issuer },
      ] } }),
    }));

    expect(await findAssetIssuer('TEST', contractId, configuration)).toBe(issuer);
    expect(await findAssetIssuer('TEST', StrKey.encodeContract(Buffer.alloc(32, 7)), configuration)).toBeNull();
  });

  it('rejects a lookalike token contract even if its symbol matches', async () => {
    const server = { getContractInstance: vi.fn().mockResolvedValue({
      executable: { type: 'contractExecutableWasm' },
    }) };

    const result = await resolveAssetIdentity(contractId, server as never, {} as never, configuration);

    expect(result.status).toBe('unverified');
    expect(result.issuer).toBeNull();
  });
});
