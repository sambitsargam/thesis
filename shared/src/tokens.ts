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
/**
 * A short, hand-checked list for quick picks in the UI.
 *
 * Every entry has been read from chain 196 and confirmed routable from USD₮0.
 * The full catalogue of several hundred equities lives in `./catalog`, which is
 * server-only; this list exists so the launcher has sensible defaults without
 * fetching anything.
 */
export const XSTOCKS: TokenizedEquity[] = [
  {ticker: "NVDAx", name: "NVIDIA", address: "0xc845b2894dBddd03858fd2D643B4eF725fE0849d", wrapped: false},
  {ticker: "AMDx", name: "AMD", address: "0x3522513e5f146a2006e2901b05f16b2821485e19", wrapped: false},
  {ticker: "TSMx", name: "TSMC", address: "0x9e3bf4ecfc44eedd624f26656b6736a3f093b073", wrapped: false},
  {ticker: "ASMLx", name: "ASML", address: "0xc0b417e7f83db438631eb5e096684dd742e5294f", wrapped: false},
  {ticker: "TSLAx", name: "Tesla", address: "0x8aD3c73F833d3F9A523aB01476625F269aEB7Cf0", wrapped: false},
  {ticker: "SPYx", name: "S&P 500 ETF", address: "0x90A2a4c76b5D8c0bc892A69EA28Aa775a8f2dD48", wrapped: false},
  {ticker: "AAPLx", name: "Apple", address: "0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a", wrapped: false},
  {ticker: "AMZNx", name: "Amazon", address: "0x3557ba345b01efa20a1bddc61f573bfd87195081", wrapped: false}
];

export function equityByAddress(address: string): TokenizedEquity | undefined {
  return XSTOCKS.find((token) => token.address.toLowerCase() === address.toLowerCase());
}
