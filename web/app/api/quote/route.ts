import {NextResponse} from "next/server";
import {deploymentFor} from "@thesis/shared";
import {fetchSwapQuotes} from "@thesis/shared/okx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAIN_ID = 196;

// The zap holds constituents mid-sale, so sell fills must land there.
const zap = (process.env.ZAP_ADDRESS ?? process.env.NEXT_PUBLIC_ZAP_ADDRESS) as
  | `0x${string}`
  | undefined;

/**
 * Server-side proxy for OKX swap quotes.
 *
 * The API secret signs every request, so this must never run in the browser. The
 * client sends amounts and receives calldata; credentials stay on the server.
 */
export async function POST(request: Request) {
  try {
    const {legs, direction} = (await request.json()) as {
      legs: Array<{token: string; amount: string}>;
      direction?: "buy" | "sell";
    };
    if (!Array.isArray(legs) || legs.length === 0) {
      return NextResponse.json({error: "No legs supplied"}, {status: 400});
    }

    const deployment = deploymentFor(CHAIN_ID);

    const results = await fetchSwapQuotes(
      legs.map((leg) => ({
        token: leg.token,
        amount: BigInt(leg.amount),
        // Selling routes the constituent into the quote token instead of out of it.
        ...(direction === "sell" ? {from: leg.token} : {})
      })),
      {
        chainId: CHAIN_ID,
        fromToken: deployment.quoteToken,
        slippagePercent: "1",
        // Buying fills into the trade adapter; selling fills into the zap.
        holder: direction === "sell" ? (zap ?? deployment.router) : deployment.router
      }
    );

    for (const quote of results) {
      if (quote.to.toLowerCase() !== deployment.okxDexRouter.toLowerCase()) {
        throw new Error(`OKX returned calldata for an unexpected router: ${quote.to}`);
      }
    }

    const quotes = results.map((quote) => ({
      data: quote.data,
      expectedOut: quote.expectedOut.toString()
    }));

    return NextResponse.json({quotes});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Quote failed";
    return NextResponse.json({error: message}, {status: 502});
  }
}
