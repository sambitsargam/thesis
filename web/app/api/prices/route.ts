import {NextResponse} from "next/server";
import {XSTOCKS} from "@thesis/shared";
import {fetchSwapQuotes} from "@thesis/shared/okx";
import {deployment} from "../../chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHAIN_ID = 196;
const PROBE_USDT = 10_000_000n; // 10 USD₮0 — large enough to price precisely.
const TTL_MS = 60_000;
const MAX_PER_REQUEST = 12;

// Cached per token, not per request: a basket can hold any of hundreds of equities,
// so a single fixed list would leave most baskets with no USD values at all.
const cache = new Map<string, {at: number; price: number}>();

function fresh(address: string): number | undefined {
  const hit = cache.get(address);
  return hit && Date.now() - hit.at < TTL_MS ? hit.price : undefined;
}

/**
 * Indicative USD price per whole token, derived from live OKX routes.
 *
 * There is no price oracle on chain, so this asks the aggregator what 10 USD₮0
 * actually buys and inverts it — an executable price rather than a reference feed.
 */
async function priceThese(addresses: string[]): Promise<Record<string, number>> {
  const prices: Record<string, number> = {};
  const missing: string[] = [];

  for (const address of addresses) {
    const cached = fresh(address);
    if (cached === undefined) missing.push(address);
    else prices[address] = cached;
  }

  if (missing.length > 0) {
    const quotes = await fetchSwapQuotes(
      missing.slice(0, MAX_PER_REQUEST).map((token) => ({token, amount: PROBE_USDT})),
      {
        chainId: CHAIN_ID,
        fromToken: deployment.quoteToken,
        slippagePercent: "1",
        holder: deployment.router
      }
    );

    quotes.forEach((quote, i) => {
      const address = missing[i]!;
      const out = Number(quote.expectedOut) / 1e18;
      if (out <= 0) return;
      const price = Number(PROBE_USDT) / 1e6 / out;
      cache.set(address, {at: Date.now(), price});
      prices[address] = price;
    });
  }

  return prices;
}

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("tokens");
  const addresses = (
    requested ? requested.split(",") : XSTOCKS.map((t) => t.address)
  )
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^0x[0-9a-f]{40}$/.test(a));

  if (addresses.length === 0) return NextResponse.json({prices: {}});

  try {
    return NextResponse.json({prices: await priceThese([...new Set(addresses)])});
  } catch (error: unknown) {
    // Stale prices beat none; the page hides USD values rather than showing a zero.
    const stale: Record<string, number> = {};
    for (const address of addresses) {
      const hit = cache.get(address);
      if (hit) stale[address] = hit.price;
    }
    if (Object.keys(stale).length > 0) return NextResponse.json({prices: stale, stale: true});
    const message = error instanceof Error ? error.message : "Could not price";
    return NextResponse.json({error: message}, {status: 502});
  }
}
