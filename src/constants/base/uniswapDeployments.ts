const uniswapDeployments = {
  public: {
    poolManager: '0x498581ff718922c3f8e6a244956af099b2652b2b',
    stateView: '0xa3c0c9b65bad0b08107aa264b0f3db444b867a71',
    positionManager: '0x7c5f5a4bbd8fd63184577525326123b519429bdc',
  },
  testnet: {
    poolManager: '0x05e73354cfdd6745c338b50bcfdfa3aa6fa03408',
    stateView: '0x571291b572ed32ce6751a2cb2486ebee8defb9b4',
    positionManager: '0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80',
  },
} as const;

export default uniswapDeployments;
