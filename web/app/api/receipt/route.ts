import {NextResponse} from "next/server";
import {decodeEventLog} from "viem";
import {thesisFactoryAbi} from "@thesis/shared";
import {publicClient} from "../../chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Waits for a createBasket receipt and returns the new basket address. */
export async function POST(request: Request) {
  try {
    const {hash} = (await request.json()) as {hash: `0x${string}`};
    const receipt = await publicClient.waitForTransactionReceipt({hash, timeout: 60_000});

    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({abi: thesisFactoryAbi, ...log});
        if (decoded.eventName === "BasketCreated") {
          return NextResponse.json({basket: decoded.args.basket, status: receipt.status});
        }
      } catch {
        // Not a factory log; keep looking.
      }
    }

    return NextResponse.json({status: receipt.status});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not read the receipt";
    return NextResponse.json({error: message}, {status: 502});
  }
}
