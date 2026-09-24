import xstocks from "./xstocks.json";
import type {TokenizedEquity} from "./tokens";

/**
 * Every tokenized equity the OKX aggregator lists on X Layer, generated from
 * `GET /api/v6/dex/aggregator/all-tokens?chainIndex=196`.
 *
 * Server-only on purpose: this is several hundred entries and has no business in
 * a browser bundle. Import it from a route handler and search there — the client
 * receives only what it asked for.
 */
export const XSTOCK_CATALOG: TokenizedEquity[] = (xstocks as Array<{
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

/** Ranks exact ticker matches first, then prefixes, then anything containing the term. */
export function searchEquities(term: string, limit = 40): TokenizedEquity[] {
  const q = term.trim().toLowerCase();
  if (!q) return XSTOCK_CATALOG.slice(0, limit);

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
