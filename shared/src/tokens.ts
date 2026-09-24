import type {Address} from "viem";

export interface TokenizedEquity {
  ticker: string;
  name: string;
  address: Address;
  /** Wrapped variants are ERC-4626 wrappers around the raw xStock share. */
  wrapped: boolean;
}

/**
 * Tokenized equities available as basket constituents on X Layer.
 *
 * Every entry has been read from chain 196 (symbol, decimals, supply) and
 * confirmed routable by the OKX aggregator from USD₮0. An unroutable token
 * would make any basket containing it permanently unmintable, so nothing goes
 * in this list unquoted.
 */
export const XSTOCKS: TokenizedEquity[] = [
  {
    ticker: "NVDAx",
    name: "NVIDIA",
    address: "0xc845b2894dBddd03858fd2D643B4eF725fE0849d",
    wrapped: false
  },
  {
    ticker: "TSLAx",
    name: "Tesla",
    address: "0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0",
    wrapped: false
  },
  {
    ticker: "SPYx",
    name: "S&P 500 ETF",
    address: "0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48",
    wrapped: false
  },
  {
    ticker: "wNVDAx",
    name: "NVIDIA (wrapped)",
    address: "0xa8ddb5cd96b5222afe198316e9a57caa642850d5",
    wrapped: true
  },
  {
    ticker: "wTSLAx",
    name: "Tesla (wrapped)",
    address: "0xc3fdbe3a68ee5de461d30415a8165cf9aefe1171",
    wrapped: true
  },
  {
    ticker: "wSPYx",
    name: "S&P 500 ETF (wrapped)",
    address: "0xe7e553cd128f0011777323a0b44a7b96ea1cb540",
    wrapped: true
  }
];

export function equityByAddress(address: string): TokenizedEquity | undefined {
  return XSTOCKS.find((token) => token.address.toLowerCase() === address.toLowerCase());
}
