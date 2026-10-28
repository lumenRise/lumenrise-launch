import type { Abi } from 'viem';

const launchAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'config',
        type: 'tuple',
        internalType: 'struct ILaunchTypes.LaunchConfig',
        components: [
          {
            name: 'factory',
            type: 'address',
            internalType: 'address',
          },
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
          {
            name: 'total_supply',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'buckets',
            type: 'tuple',
            internalType: 'struct ILaunchTypes.Buckets',
            components: [
              {
                name: 'pool',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'curve',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'team',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
        ],
      },
      {
        name: 'graduation_',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'buy',
    inputs: [
      {
        name: 'buyer',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'pair_amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'min_received',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'q',
        type: 'tuple',
        internalType: 'struct IBondingCurve.Quote',
        components: [
          {
            name: 'gross',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'creator_fee',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'user_amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'amount_received',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'buyer_count',
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
    name: 'claim_creator_fees',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim_creator_payout',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim_graduation_dust',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'asset_amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'pair_amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim_liquidity_fees',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'asset_amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'pair_amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim_platform_fee',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claim_team',
    inputs: [],
    outputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'claimable_team',
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
    name: 'current_price',
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
    name: 'get_config',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct ILaunchTypes.LaunchConfig',
        components: [
          {
            name: 'factory',
            type: 'address',
            internalType: 'address',
          },
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
          {
            name: 'total_supply',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'buckets',
            type: 'tuple',
            internalType: 'struct ILaunchTypes.Buckets',
            components: [
              {
                name: 'pool',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'curve',
                type: 'uint256',
                internalType: 'uint256',
              },
              {
                name: 'team',
                type: 'uint256',
                internalType: 'uint256',
              },
            ],
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'get_state',
    inputs: [],
    outputs: [
      {
        name: 's',
        type: 'tuple',
        internalType: 'struct IBondingCurve.State',
        components: [
          {
            name: 'sold',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'quote_reserve',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'creator_fees',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'team_claimed',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'buyer_count',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'graduated',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'busy',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'graduation_preview',
    inputs: [],
    outputs: [
      {
        name: 'p',
        type: 'tuple',
        internalType: 'struct IBondingCurve.GraduationPreview',
        components: [
          {
            name: 'creator_payout',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'platform_fee',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'pool_pair_amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'pool_asset_amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'unsold_curve_amount',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'graduation_state',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IBondingCurve.GraduationState',
        components: [
          {
            name: 'settled',
            type: 'bool',
            internalType: 'bool',
          },
          {
            name: 'pool_id',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'token_id',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'liquidity',
            type: 'uint128',
            internalType: 'uint128',
          },
          {
            name: 'asset_deposited',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'pair_deposited',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'creator_payout',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'platform_fee',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'asset_dust',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'pair_dust',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'is_eligible',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'pure',
  },
  {
    type: 'function',
    name: 'quote_buy',
    inputs: [
      {
        name: 'pair_amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'q',
        type: 'tuple',
        internalType: 'struct IBondingCurve.Quote',
        components: [
          {
            name: 'gross',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'creator_fee',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'user_amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'amount_received',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'quote_sell',
    inputs: [
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'q',
        type: 'tuple',
        internalType: 'struct IBondingCurve.Quote',
        components: [
          {
            name: 'gross',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'creator_fee',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'user_amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'amount_received',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'sell',
    inputs: [
      {
        name: 'seller',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'min_received',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'q',
        type: 'tuple',
        internalType: 'struct IBondingCurve.Quote',
        components: [
          {
            name: 'gross',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'creator_fee',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'user_amount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'amount_received',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'sellable_balance',
    inputs: [
      {
        name: 'buyer',
        type: 'address',
        internalType: 'address',
      },
    ],
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
    name: 'status',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'enum ILaunchTypes.LaunchStatus',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'Bought',
    inputs: [
      {
        name: 'buyer',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'payment',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'received',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'creator_fee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'CreatorFeesClaimed',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Graduated',
    inputs: [
      {
        name: 'quote_reserve',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'sold',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GraduationDustClaimed',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'asset_amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'pair_amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'GraduationPayoutClaimed',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'platform',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'LiquidityFeesClaimed',
    inputs: [
      {
        name: 'recipient',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'asset_amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'pair_amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'Sold',
    inputs: [
      {
        name: 'seller',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'received',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'creator_fee',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TeamClaimed',
    inputs: [
      {
        name: 'owner',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'amount',
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

export default launchAbi;
