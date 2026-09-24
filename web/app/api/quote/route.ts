import {NextResponse} from "next/server";
import {deploymentFor} from "@thesis/shared";
import {fetchSwapQuote} from "@thesis/shared/okx";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAIN_ID = 196;

/**
 * Server-side proxy for OKX swap quotes.
 *
 * The API secret signs every request, so this must never run in the browser. The
 * client sends amounts and receives calldata; credentials stay on the server.
 */
export async function POST(request: Request) {
  try {
    const {legs} = (await request.json()) as {legs: Array<{token: string; amount: string}>};
    if (!Array.isArray(legs) || legs.length === 0) {
      return NextResponse.json({error: "No legs supplied"}, {status: 400});
    }

    const deployment = deploymentFor(CHAIN_ID);

    const quotes = await Promise.all(
      legs.map(async (leg) => {
        const quote = await fetchSwapQuote({
          chainId: CHAIN_ID,
          fromToken: deployment.quoteToken,
          toToken: leg.token,
          amount: BigInt(leg.amount),
          slippagePercent: "1",
          holder: deployment.router
        });

        if (quote.to.toLowerCase() !== deployment.okxDexRouter.toLowerCase()) {
          throw new Error(`OKX returned calldata for an unexpected router: ${quote.to}`);
        }
        return {data: quote.data, expectedOut: quote.expectedOut.toString()};
      })
    );

    return NextResponse.json({quotes});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Quote failed";
    return NextResponse.json({error: message}, {status: 502});
  }
}
