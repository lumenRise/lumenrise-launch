import type { LaunchData } from '../../src/types/launch/model';

const createOptimizedLaunch = (overrides: Partial<LaunchData> = {}): LaunchData => ({
  chain: 'base',
  network: 'testnet',
  factoryContractId: '0x3333333333333333333333333333333333333333',
  factoryIndex: 1,
  contractId: '0x1111111111111111111111111111111111111111',
  slug: 'blue-project',
  owner: '0x2222222222222222222222222222222222222222',
  asset: '0x4444444444444444444444444444444444444444',
  pair: '0x5555555555555555555555555555555555555555',
  assetDecimals: 18,
  pairDecimals: 6,
  metadata: {
    name: 'Blue Project',
    symbol: 'BLUE',
    logo: 'https://images.example/blue.png',
    description: '',
  },
  config: {},
  state: { graduated: false },
  asOfLedger: 1,
  observedAt: new Date(),
  stateAsOfLedger: 1,
  stateObservedAt: new Date(),
  creationLedger: 1,
  tradeCoverageFrom: 1,
  nextStatePollAt: new Date(Date.now() + 900_000),
  ...overrides,
});

export default createOptimizedLaunch;
