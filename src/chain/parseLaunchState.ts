import toPlainValue from './toPlainValue';

const parseLaunchState = (raw: unknown): Record<string, unknown> => {
  const value = toPlainValue(raw);

  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Launch state is not a struct');
  }

  const state = value as Record<string, unknown>;

  if (
    typeof state.sold !== 'string' ||
    typeof state.quote_reserve !== 'string' ||
    typeof state.team_claimed !== 'string' ||
    typeof state.buyer_count !== 'number' ||
    typeof state.graduated !== 'boolean'
  ) {
    throw new Error('Launch state has invalid fields');
  }

  return state;
};

export default parseLaunchState;
