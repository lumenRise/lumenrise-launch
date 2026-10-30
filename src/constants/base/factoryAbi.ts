import type { Abi } from 'viem';

const factoryAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'settings_',
        type: 'tuple',
        internalType: 'struct IFactory.FactorySettings',
        components: [
          {
            name: 'platform',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'platform_fee_bps',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'pair',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'graduation',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'create_bonding_curve',
    inputs: [
      {
        name: 'params',
        type: 'tuple',
        internalType: 'struct ILaunchTypes.LaunchParams',
        components: [
          {
            name: 'owner',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'asset',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'pair',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'metadata',
            type: 'tuple',
            internalType: 'struct ILaunchTypes.Metadata',
            components: [
              {
                name: 'name',
                type: 'string',
                internalType: 'string',
              },
              {
                name: 'description',
                type: 'string',
                internalType: 'string',
              },
              {
                name: 'logo',
                type: 'string',
                internalType: 'string',
              },
              {
                name: 'symbol',
                type: 'string',
                internalType: 'string',
              },
            ],
          },
          {
            name: 'allocations',
            type: 'tuple',
            internalType: 'struct ILaunchTypes.Allocations',
            components: [
              {
                name: 'pool_bps',
                type: 'uint32',
                internalType: 'uint32',
              },
              {
                name: 'curve_bps',
                type: 'uint32',
                internalType: 'uint32',
              },
              {
                name: 'team_bps',
                type: 'uint32',
                internalType: 'uint32',
              },
            ],
          },
          {
            name: 'vesting',
            type: 'tuple',
            internalType: 'struct ILaunchTypes.Vesting',
            components: [
              {
                name: 'cliff_seconds',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'duration_seconds',
                type: 'uint64',
                internalType: 'uint64',
              },
              {
                name: 'schedule',
                type: 'uint8',
                internalType: 'enum ILaunchTypes.UnlockSchedule',
              },
            ],
          },
          {
            name: 'curve',
            type: 'tuple',
            internalType: 'struct ILaunchTypes.CurveSettings',
            components: [
              {
                name: 'virtual_base_reserve',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'virtual_quote_reserve',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'graduation_target',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'creator_fee_bps',
                type: 'uint32',
                internalType: 'uint32',
              },
              {
                name: 'creator_payout_bps',
                type: 'uint32',
                internalType: 'uint32',
              },
            ],
          },
          {
            name: 'starts_at',
            type: 'uint64',
            internalType: 'uint64',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'child',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'launch_at',
    inputs: [
      {
        name: 'index',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'launch_count',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'settings',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IFactory.FactorySettings',
        components: [
          {
            name: 'platform',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'platform_fee_bps',
            type: 'uint32',
            internalType: 'uint32',
          },
          {
            name: 'pair',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'graduation',
            type: 'address',
            internalType: 'address',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'FactoryConfigured',
    inputs: [
      {
        name: 'platform',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'pair',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'platform_fee_bps',
        type: 'uint32',
        indexed: false,
        internalType: 'uint32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LaunchCreated',
    inputs: [
      {
        name: 'index',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'curve',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'asset',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'deposited',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'InvalidConfig',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSupply',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidTrade',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoClaim',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NoReserve',
    inputs: [],
  },
  {
    type: 'error',
    name: 'NotOpen',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Overflow',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Reentrancy',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ReputationRequired',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeERC20FailedOperation',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'Slippage',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SoldOut',
    inputs: [],
  },
  {
    type: 'error',
    name: 'Unauthorized',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnknownLabel',
    inputs: [],
  },
  {
    type: 'error',
    name: 'UnsupportedTransfer',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'WrongAsset',
    inputs: [],
  },
] as const satisfies Abi;

export default factoryAbi;
