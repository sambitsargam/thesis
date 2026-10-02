import {defineChain} from "viem";

/** X Layer mainnet. Gas token is OKB. Explorer is OKLink. */
export const xLayer = defineChain({
  id: 196,
  name: "X Layer",
  nativeCurrency: {name: "OKB", symbol: "OKB", decimals: 18},
  rpcUrls: {
    default: {http: ["https://rpc.xlayer.tech", "https://xlayerrpc.okx.com"]}
  },
  blockExplorers: {
    default: {name: "OKLink", url: "https://www.oklink.com/xlayer"}
  },
  // Canonical Multicall3, verified deployed on X Layer. Declaring it lets viem fold
  // hundreds of reads into a handful of calls; without it every `readContract` is its
  // own round trip, and a page listing sixteen baskets makes nearly three hundred.
  contracts: {
    multicall3: {address: "0xcA11bde05977b3631167028862bE2a173976CA11"}
  }
});

/** X Layer testnet. Faucet is rate limited to 0.01 OKB per day. */
export const xLayerTestnet = defineChain({
  id: 1952,
  name: "X Layer Testnet",
  testnet: true,
  nativeCurrency: {name: "OKB", symbol: "OKB", decimals: 18},
  rpcUrls: {
    default: {http: ["https://testrpc.xlayer.tech"]}
  },
  blockExplorers: {
    default: {name: "OKLink", url: "https://www.oklink.com/x-layer-testnet"}
  }
});

export const SUPPORTED_CHAINS = [xLayer, xLayerTestnet] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"];
