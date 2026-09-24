/** Minimal ABI fragments. The single source of truth for agent/ and web/. */

export const thesisBasketAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      {name: "quoteAmount", type: "uint256"},
      {name: "minSharesOut", type: "uint256"},
      {name: "swapData", type: "bytes[]"}
    ],
    outputs: [{name: "shares", type: "uint256"}]
  },
  {
    type: "function",
    name: "redeem",
    stateMutability: "nonpayable",
    inputs: [{name: "shares", type: "uint256"}],
    outputs: [{name: "amounts", type: "uint256[]"}]
  },
  {
    type: "function",
    name: "constituents",
    stateMutability: "view",
    inputs: [],
    outputs: [{type: "address[]"}]
  },
  {
    type: "function",
    name: "navPerShare",
    stateMutability: "view",
    inputs: [],
    outputs: [{name: "tokens", type: "address[]"}, {name: "units", type: "uint256[]"}]
  },
  {type: "function", name: "theme", stateMutability: "view", inputs: [], outputs: [{type: "string"}]},
  {type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{type: "string"}]},
  {type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{type: "string"}]},
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{type: "uint256"}]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{type: "address"}],
    outputs: [{type: "uint256"}]
  },
  {
    type: "function",
    name: "quoteToken",
    stateMutability: "view",
    inputs: [],
    outputs: [{type: "address"}]
  },
  {type: "function", name: "router", stateMutability: "view", inputs: [], outputs: [{type: "address"}]}
] as const;

export const thesisFactoryAbi = [
  {
    type: "function",
    name: "createBasket",
    stateMutability: "nonpayable",
    inputs: [
      {name: "name_", type: "string"},
      {name: "symbol_", type: "string"},
      {name: "theme_", type: "string"},
      {name: "constituents_", type: "address[]"}
    ],
    outputs: [{name: "basket", type: "address"}]
  },
  {type: "function", name: "baskets", stateMutability: "view", inputs: [], outputs: [{type: "address[]"}]},
  {
    type: "function",
    name: "creatorOf",
    stateMutability: "view",
    inputs: [{type: "address"}],
    outputs: [{type: "address"}]
  },
  {
    type: "function",
    name: "basketsOf",
    stateMutability: "view",
    inputs: [{type: "address"}],
    outputs: [{type: "address[]"}]
  },
  {
    type: "function",
    name: "basketCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{type: "uint256"}]
  },
  {
    type: "event",
    name: "BasketCreated",
    inputs: [
      {name: "basket", type: "address", indexed: true},
      {name: "creator", type: "address", indexed: true},
      {name: "index", type: "uint256", indexed: true},
      {name: "name", type: "string", indexed: false},
      {name: "symbol", type: "string", indexed: false},
      {name: "theme", type: "string", indexed: false},
      {name: "constituents", type: "address[]", indexed: false}
    ]
  }
] as const;

export const erc20Abi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [{type: "address"}, {type: "uint256"}],
    outputs: [{type: "bool"}]
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [{type: "address"}, {type: "address"}],
    outputs: [{type: "uint256"}]
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{type: "address"}],
    outputs: [{type: "uint256"}]
  },
  {type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{type: "uint8"}]},
  {type: "function", name: "symbol", stateMutability: "view", inputs: [], outputs: [{type: "string"}]}
] as const;

export const thesisZapAbi = [
  {
    type: "function",
    name: "sellForQuote",
    stateMutability: "nonpayable",
    inputs: [
      {name: "basket", type: "address"},
      {name: "shares", type: "uint256"},
      {name: "swapData", type: "bytes[]"},
      {name: "minQuoteOut", type: "uint256"}
    ],
    outputs: [{name: "quoteOut", type: "uint256"}]
  },
  {type: "function", name: "router", stateMutability: "view", inputs: [], outputs: [{type: "address"}]}
] as const;
