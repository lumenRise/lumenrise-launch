import type { Abi } from 'viem';

// Provisional ABI: replace and verify against the deployed Base contracts before activation.
const launchAbi = [
  {
    type: 'function',
    name: 'get_config',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          {
            name: 'factory',
            type: 'address',
          },
          {
            name: 'platform',
            type: 'address',
          },
          {
            name: 'platform_fee_bps',
            type: 'uint32',
          },
          {
            name: 'reputation',
            type: 'address',
          },
          {
            name: 'params',
            type: 'tuple',
            components: [
              {
                name: 'owner',
                type: 'address',
              },
              {
                name: 'asset',
                type: 'address',
              },
              {
                name: 'pair',
                type: 'address',
              },
              {
                name: 'metadata',
                type: 'tuple',
                components: [
                  {
                    name: 'name',
                    type: 'string',
                  },
                  {
                    name: 'description',
                    type: 'string',
                  },
                  {
                    name: 'logo',
                    type: 'string',
                  },
                  {
                    name: 'symbol',
                    type: 'string',
                  },
                ],
              },
              {
                name: 'allocations',
                type: 'tuple',
                components: [
                  {
                    name: 'pool_bps',
                    type: 'uint32',
                  },
                  {
                    name: 'curve_bps',
                    type: 'uint32',
                  },
                  {
                    name: 'team_bps',
                    type: 'uint32',
                  },
                ],
              },
              {
                name: 'vesting',
                type: 'tuple',
                components: [
                  {
                    name: 'cliff_seconds',
                    type: 'uint64',
                  },
                  {
                    name: 'duration_seconds',
                    type: 'uint64',
                  },
                  {
                    name: 'schedule',
                    type: 'uint8',
                  },
                ],
              },
              {
                name: 'curve',
                type: 'tuple',
                components: [
                  {
                    name: 'virtual_base_reserve',
                    type: 'uint128',
                  },
                  {
                    name: 'virtual_quote_reserve',
                    type: 'uint128',
                  },
                  {
                    name: 'graduation_target',
                    type: 'uint128',
                  },
                  {
                    name: 'creator_fee_bps',
                    type: 'uint32',
                  },
                  {
                    name: 'creator_payout_bps',
                    type: 'uint32',
                  },
                ],
              },
              {
                name: 'starts_at',
                type: 'uint64',
              },
              {
                name: 'reputation_label',
                type: 'uint64',
              },
            ],
          },
          {
            name: 'total_supply',
            type: 'uint128',
          },
          {
            name: 'buckets',
            type: 'tuple',
            components: [
              {
                name: 'pool',
                type: 'uint128',
              },
              {
                name: 'curve',
                type: 'uint128',
              },
              {
                name: 'team',
                type: 'uint128',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'get_state',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          {
            name: 'sold',
            type: 'uint128',
          },
          {
            name: 'quote_reserve',
            type: 'uint128',
          },
          {
            name: 'creator_fees',
            type: 'uint128',
          },
          {
            name: 'team_claimed',
            type: 'uint128',
          },
          {
            name: 'buyer_count',
            type: 'uint32',
          },
          {
            name: 'graduated',
            type: 'bool',
          },
          {
            name: 'busy',
            type: 'bool',
          },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'current_price',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint128',
      },
    ],
  },
  {
    type: 'function',
    name: 'buy',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'trader',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint128',
      },
      {
        name: 'limit',
        type: 'uint128',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          {
            name: 'gross',
            type: 'uint128',
          },
          {
            name: 'creator_fee',
            type: 'uint128',
          },
          {
            name: 'user_amount',
            type: 'uint128',
          },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'sell',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'trader',
        type: 'address',
      },
      {
        name: 'amount',
        type: 'uint128',
      },
      {
        name: 'limit',
        type: 'uint128',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          {
            name: 'gross',
            type: 'uint128',
          },
          {
            name: 'creator_fee',
            type: 'uint128',
          },
          {
            name: 'user_amount',
            type: 'uint128',
          },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'quote_buy',
    stateMutability: 'view',
    inputs: [
      {
        name: 'amount',
        type: 'uint128',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          {
            name: 'gross',
            type: 'uint128',
          },
          {
            name: 'creator_fee',
            type: 'uint128',
          },
          {
            name: 'user_amount',
            type: 'uint128',
          },
        ],
      },
    ],
  },
  {
    type: 'function',
    name: 'quote_sell',
    stateMutability: 'view',
    inputs: [
      {
        name: 'amount',
        type: 'uint128',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        components: [
          {
            name: 'gross',
            type: 'uint128',
          },
          {
            name: 'creator_fee',
            type: 'uint128',
          },
          {
            name: 'user_amount',
            type: 'uint128',
          },
        ],
      },
    ],
  },
  {
    type: 'event',
    name: 'Trade',
    anonymous: false,
    inputs: [
      {
        name: 'trader',
        type: 'address',
        indexed: true,
      },
      {
        name: 'isBuy',
        type: 'bool',
        indexed: false,
      },
      {
        name: 'assetAmount',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'grossAmount',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'creatorFee',
        type: 'uint128',
        indexed: false,
      },
      {
        name: 'userAmount',
        type: 'uint128',
        indexed: false,
      },
    ],
  },
] as const satisfies Abi;

export default launchAbi;
