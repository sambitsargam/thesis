import {NextResponse} from "next/server";
import {XSTOCKS} from "@thesis/shared";
import {fetchSwapQuotes} from "@thesis/shared/okx";
import {deployment} from "../../chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAIN_ID = 196;
const PROBE_USDT = 10_000_000n; // 10 USD₮0 — large enough to price precisely.
const TTL_MS = 60_000;

interface Cached {
  at: number;
  prices: Record<string, number>;
}

// Module-level cache: quoting six legs costs ~1.5s and the aggregator rate limits.
let cache: Cached | null = null;

/**
 * Indicative USD price per whole token, derived from live OKX routes.
 *
 * There is no price oracle on chain, so this asks the aggregator what 10 USD₮0
 * actually buys and inverts it. That makes these executable prices rather than
 * a reference feed — which is the honest number to show next to a basket whose
 * NAV is only ever realised by trading.
 */
export async function GET() {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return NextResponse.json({prices: cache.prices, cached: true});
  }

  try {
    const quotes = await fetchSwapQuotes(
      XSTOCKS.map((token) => ({token: token.address, amount: PROBE_USDT})),
      {
        chainId: CHAIN_ID,
        fromToken: deployment.quoteToken,
        slippagePercent: "1",
        holder: deployment.router
      }
    );

    const prices: Record<string, number> = {};
    quotes.forEach((quote, i) => {
      const token = XSTOCKS[i]!;
      const out = Number(quote.expectedOut) / 1e18;
      if (out > 0) prices[token.address.toLowerCase()] = Number(PROBE_USDT) / 1e6 / out;
    });

    cache = {at: Date.now(), prices};
    return NextResponse.json({prices, cached: false});
  } catch (error: unknown) {
    // Stale prices beat no prices; the page degrades to hiding USD values.
    if (cache) return NextResponse.json({prices: cache.prices, stale: true});
    const message = error instanceof Error ? error.message : "Could not price";
    return NextResponse.json({error: message}, {status: 502});
  }
}
