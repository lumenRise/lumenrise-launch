import mongoose from 'mongoose';
import { beforeEach, expect, it, vi } from 'vitest';

import refreshLaunchHolder from '../../../src/services/launch/refreshLaunchHolder';
import refreshStellarHoldings from '../../../src/services/stellar/refreshStellarHoldings';

vi.mock('../../../src/services/stellar/refreshStellarHoldings', () => ({ default: vi.fn() }));

beforeEach((): void => {
  vi.restoreAllMocks();

  vi.spyOn(mongoose.connection, 'transaction').mockImplementation(async (work) =>
    work({} as never),
  );
});

it('drains legacy holder jobs by rebuilding recorded trades without querying balances', async (): Promise<void> => {
  const reader = { network: 'testnet' as const, tokenBalance: vi.fn() };
  const identity = { chain: 'stellar' as const, network: 'testnet' as const, contractId: 'launch' };

  await refreshLaunchHolder(reader, identity);

  expect(refreshStellarHoldings).toHaveBeenCalledWith(identity, {});

  expect(reader.tokenBalance).not.toHaveBeenCalled();
});
