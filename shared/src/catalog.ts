import routable from "./routable.json";
import xstocks from "./xstocks.json";
import type {TokenizedEquity} from "./tokens";

/**
 * Addresses confirmed to have live DEX liquidity from USD₮0.
 *
 * The aggregator lists far more tokens than can actually be traded. A basket
 * holding an illiquid one can never be minted, and constituents are fixed at
 * deployment, so selection is restricted to this set.
 *
 * Regenerate with `demo/probe-liquidity.ts` when liquidity changes.
 */
const ROUTABLE = new Set((routable as string[]).map((a) => a.toLowerCase()));

export function isRoutable(address: string): boolean {
  return ROUTABLE.has(address.toLowerCase());
}

/** How many equities can actually be bought right now. */
export const ROUTABLE_COUNT = ROUTABLE.size;

/** Every xStock the aggregator lists, tradeable or not. */
export const LISTED_COUNT = xstocks.length;

/**
 * Every tokenized equity the OKX aggregator lists on X Layer, generated from
 * `GET /api/v6/dex/aggregator/all-tokens?chainIndex=196`.
 *
 * Server-only on purpose: this is several hundred entries and has no business in
 * a browser bundle. Import it from a route handler and search there — the client
 * receives only what it asked for.
 */
const ALL_XSTOCKS: TokenizedEquity[] = (xstocks as Array<{
  ticker: string;
  name: string;
  address: string;
  decimals: number;
}>).map((token) => ({
  ticker: token.ticker,
  name: token.name,
  address: token.address as `0x${string}`,
  wrapped: token.ticker.startsWith("w")
}));

/** Only equities that can actually be traded. Everything downstream uses this. */
export const XSTOCK_CATALOG: TokenizedEquity[] = ALL_XSTOCKS.filter((t) =>
  isRoutable(t.address)
);

/**
 * Ranks exact ticker matches first, then prefixes, then anything containing the term.
 *
 * With no term the whole catalogue is returned. Truncating it silently made the list
 * appear to end mid-alphabet, which reads as a broken scroll rather than a page limit.
 */
export function searchEquities(term: string, limit = 250): TokenizedEquity[] {
  const q = term.trim().toLowerCase();
  if (!q) return XSTOCK_CATALOG;

  const scored = XSTOCK_CATALOG.map((token) => {
    const ticker = token.ticker.toLowerCase();
    const name = token.name.toLowerCase();
    if (ticker === q || ticker === `${q}x`) return {token, score: 0};
    if (ticker.startsWith(q)) return {token, score: 1};
    if (name.startsWith(q)) return {token, score: 2};
    if (name.includes(q)) return {token, score: 3};
    if (ticker.includes(q)) return {token, score: 4};
    return {token, score: 99};
  })
    .filter((entry) => entry.score < 99)
    .sort((a, b) => a.score - b.score || a.token.ticker.localeCompare(b.token.ticker));

  return scored.slice(0, limit).map((entry) => entry.token);
}

export function equityFor(address: string): TokenizedEquity | undefined {
  return XSTOCK_CATALOG.find((t) => t.address.toLowerCase() === address.toLowerCase());
}
