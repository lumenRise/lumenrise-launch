import { afterEach, describe, expect, it, vi } from 'vitest';

import checkHorizonAvailability from '../../../src/services/stellar/checkHorizonAvailability';

afterEach((): void => {
  vi.unstubAllGlobals();
});

describe('Horizon availability', () => {
  it('accepts a reachable Horizon without checking its network passphrase', async (): Promise<void> => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      network_passphrase: 'Test SDF Network ; September 2015',
    }))));

    await expect(checkHorizonAvailability('https://horizon-testnet.stellar.org')).resolves.toBeUndefined();
  });

  it('propagates unsuccessful Horizon responses', async (): Promise<void> => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(checkHorizonAvailability('https://horizon-testnet.stellar.org')).rejects.toThrow(
      'Horizon root request failed: 503',
    );
  });
});
