import type { StatsScope } from '../../types/stats/activity';

const statsScopes: readonly StatsScope[] = [
  { chain: 'stellar', network: 'testnet', cursorKey: 'stellarTestnetCursor' },
  { chain: 'base', network: 'testnet', cursorKey: 'baseTestnetCursor' },
  { chain: 'stellar', network: 'public', cursorKey: 'stellarPublicCursor' },
  { chain: 'base', network: 'public', cursorKey: 'basePublicCursor' },
  { chain: 'all', network: 'testnet', cursorKey: 'combinedTestnetCursor' },
  { chain: 'all', network: 'public', cursorKey: 'combinedPublicCursor' },
];

export default statsScopes;
