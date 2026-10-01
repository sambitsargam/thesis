import {NextResponse} from "next/server";
import {DEFAULT_PRICED, priceTokens, stalePrice} from "../../prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get("tokens");
  const addresses = (
    requested ? requested.split(",") : DEFAULT_PRICED
  )
    .map((a) => a.trim().toLowerCase())
    .filter((a) => /^0x[0-9a-f]{40}$/.test(a));

  if (addresses.length === 0) return NextResponse.json({prices: {}});

  try {
    return NextResponse.json({prices: await priceTokens([...new Set(addresses)])});
  } catch (error: unknown) {
    // Stale prices beat none; the page hides USD values rather than showing a zero.
    const stale: Record<string, number> = {};
    for (const address of addresses) {
      const hit = stalePrice(address);
      if (hit !== undefined) stale[address] = hit;
    }
    if (Object.keys(stale).length > 0) return NextResponse.json({prices: stale, stale: true});
    const message = error instanceof Error ? error.message : "Could not price";
    return NextResponse.json({error: message}, {status: 502});
  }
}
