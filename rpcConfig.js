// Central place for all RPC endpoints.
// NOTE: only Ethereum Mainnet (netId1) is actively used by this deployment,
// other networks are kept for config completeness only.
const {
  INFURA_KEY,
  ALCHEMY_MAINNET_KEY,
  ALCHEMY_POLYGON_KEY,
  ALCHEMY_OPTIMISM_KEY,
  ALCHEMY_ARBITRUM_KEY,
  ALCHEMY_GOERLI_KEY
} = process.env

export default {
  netId1: {
    Ankr: {
      name: 'Ankr',
      url: 'https://rpc.ankr.com/eth/47bc999735174156f83a6beedf6ebe21b176ce5557722134222ac721f8761c2a'
    },
    Infura: {
      name: 'Infura',
      url: `https://mainnet.infura.io/v3/${INFURA_KEY}`
    },
    Alchemy: {
      name: 'Alchemy',
      url: `https://eth-mainnet.alchemyapi.io/v2/${ALCHEMY_MAINNET_KEY}`
    }
  },
  netId56: {
    publicRpc1: {
      name: 'BSC Public RPC 1',
      url: 'https://bsc-dataseed.binance.org/'
    },
    publicRpc2: {
      name: 'BSC Public RPC 2',
      url: 'https://bsc-dataseed1.defibit.io/'
    },
    publicRpc3: {
      name: 'BSC Public RPC 3',
      url: 'https://bsc-dataseed1.ninicoin.io/'
    }
  },
  netId137: {
    Infura: {
      name: 'Infura',
      url: `https://polygon-mainnet.infura.io/v3/${INFURA_KEY}`
    },
    Alchemy: {
      name: 'Alchemy',
      url: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_POLYGON_KEY}`
    }
  },
  netId10: {
    Alchemy: {
      name: 'Alchemy',
      url: `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_OPTIMISM_KEY}`
    },
    Infura: {
      name: 'Infura',
      url: `https://optimism-mainnet.infura.io/v3/${INFURA_KEY}`
    }
  },
  netId42161: {
    Arbitrum: {
      name: 'Arbitrum Public RPC',
      url: 'https://arb1.arbitrum.io/rpc'
    },
    Alchemy: {
      name: 'Alchemy',
      url: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_ARBITRUM_KEY}`
    },
    Infura: {
      name: 'Infura',
      url: `https://arbitrum-mainnet.infura.io/v3/${INFURA_KEY}`
    }
  },
  netId100: {
    publicRpc: {
      name: 'Gnosis Chain RPC',
      url: 'https://rpc.gnosischain.com/tornado'
    }
  },
  netId43114: {
    publicRpc: {
      name: 'Avalanche RPC',
      url: 'https://api.avax.network/ext/bc/C/rpc'
    }
  },
  netId5: {
    Alchemy: {
      name: 'Alchemy',
      url: `https://eth-goerli.alchemyapi.io/v2/${ALCHEMY_GOERLI_KEY}`
    }
  }
}
