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
  }
});

/** X Layer testnet. Faucet is rate limited to 0.01 OKB per day. */
export const xLayerTestnet = defineChain({
  id: 195,
  name: "X Layer Testnet",
  testnet: true,
  nativeCurrency: {name: "OKB", symbol: "OKB", decimals: 18},
  rpcUrls: {
    default: {http: ["https://testrpc.xlayer.tech"]}
  },
  blockExplorers: {
    default: {name: "OKLink", url: "https://www.oklink.com/xlayer-test"}
  }
});

export const SUPPORTED_CHAINS = [xLayer, xLayerTestnet] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["id"];
