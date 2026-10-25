import type { Abi } from 'viem';

// Provisional ABI: replace and verify against the deployed Base contracts before activation.
const factoryAbi = [
  {
    type: 'function',
    name: 'launch_count',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint32',
      },
    ],
  },
  {
    type: 'function',
    name: 'launch_at',
    stateMutability: 'view',
    inputs: [
      {
        name: 'index',
        type: 'uint32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
      },
    ],
  },
  {
    type: 'function',
    name: 'create_bonding_curve',
    stateMutability: 'nonpayable',
    inputs: [
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
    ],
    outputs: [
      {
        name: '',
        type: 'address',
      },
    ],
  },
  {
    type: 'event',
    name: 'LaunchCreated',
    anonymous: false,
    inputs: [
      {
        name: 'launch',
        type: 'address',
        indexed: true,
      },
      {
        name: 'owner',
        type: 'address',
        indexed: true,
      },
      {
        name: 'index',
        type: 'uint32',
        indexed: false,
      },
    ],
  },
] as const satisfies Abi;

export default factoryAbi;
