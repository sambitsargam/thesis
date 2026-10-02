import {XSTOCKS} from "@thesis/shared";
import {fetchSwapQuotes} from "@thesis/shared/okx";
import {deployment} from "./chain";

const CHAIN_ID = 196;
const PROBE_USDT = 10_000_000n; // 10 USD₮0 — large enough to price precisely.
const TTL_MS = 180_000;
const PER_REQUEST = 12;

// Cached per token, not per request: a basket can hold any of hundreds of equities,
// so a single fixed list would leave most baskets with no USD values at all.
const cache = new Map<string, {at: number; price: number}>();

function fresh(address: string): number | undefined {
  const hit = cache.get(address);
  return hit && Date.now() - hit.at < TTL_MS ? hit.price : undefined;
}

/** Last price seen for a token, however old. Used when a live quote fails. */
export function stalePrice(address: string): number | undefined {
  return cache.get(address.toLowerCase())?.price;
}

/** Every token the market strip shows by default. */
export const DEFAULT_PRICED = XSTOCKS.map((t) => t.address);

/**
 * Indicative USD price per whole token, derived from live OKX routes.
 *
 * There is no price oracle on chain, so this asks the aggregator what 10 USD₮0
 * actually buys and inverts it — an executable price rather than a reference feed.
 */
export async function priceTokens(input: string[]): Promise<Record<string, number>> {
  // Normalised here so callers can pass checksummed addresses straight from the chain
  // and still hit the same cache entries as the API route's lowercased ones.
  const addresses = [...new Set(input.map((a) => a.toLowerCase()))];
  const prices: Record<string, number> = {};
  const missing: string[] = [];

  for (const address of addresses) {
    const cached = fresh(address);
    if (cached === undefined) missing.push(address);
    else prices[address] = cached;
  }

  /*
   * Every missing token is priced, in chunks — not just the first dozen.
   *
   * Truncating was invisible while a handful of baskets shared the same few equities. It
   * stops being invisible the moment the catalogue spreads across a dozen baskets: any
   * basket holding an unpriced token values as null, so a leaderboard of sixteen baskets
   * reported a total value of $0.00 while holding real money.
   */
  for (let from = 0; from < missing.length; from += PER_REQUEST) {
    const chunk = missing.slice(from, from + PER_REQUEST);
    const quotes = await fetchSwapQuotes(
      chunk.map((token) => ({token, amount: PROBE_USDT})),
      {
        chainId: CHAIN_ID,
        fromToken: deployment.quoteToken,
        slippagePercent: "1",
        holder: deployment.router
      }
    ).catch(() => []);

    quotes.forEach((quote, i) => {
      const address = chunk[i]!;
      const out = Number(quote.expectedOut) / 1e18;
      if (out <= 0) return;
      const price = Number(PROBE_USDT) / 1e6 / out;
      cache.set(address, {at: Date.now(), price});
      prices[address] = price;
    });
  }

  return prices;
}
