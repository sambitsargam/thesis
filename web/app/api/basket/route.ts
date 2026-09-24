import {NextResponse} from "next/server";
import {formatUnits} from "viem";
import {erc20Abi, thesisBasketAbi} from "@thesis/shared";
import {publicClient} from "../../chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface LiveBasket {
  supply: string;
  holdings: Array<{ticker: string; address: string; held: string; perShare: string}>;
  blockNumber: string;
}

/**
 * Live basket state for client-side polling.
 *
 * The RPC call stays on the server so the browser never needs a CORS-friendly
 * endpoint, and the response is small enough to poll every few seconds.
 */
export async function POST(request: Request) {
  try {
    const {address} = (await request.json()) as {address: string};
    const basket = address as `0x${string}`;

    const [supply, nav, constituents, blockNumber] = await Promise.all([
      publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "totalSupply"}),
      publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "navPerShare"}),
      publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "constituents"}),
      publicClient.getBlockNumber()
    ]);

    const [, units] = nav;

    const holdings = await Promise.all(
      constituents.map(async (token, i) => {
        const [ticker, held] = await Promise.all([
          publicClient
            .readContract({address: token, abi: erc20Abi, functionName: "symbol"})
            .catch(() => "?"),
          publicClient.readContract({
            address: token,
            abi: erc20Abi,
            functionName: "balanceOf",
            args: [basket]
          })
        ]);

        return {
          ticker,
          address: token,
          held: formatUnits(held, 18),
          perShare: formatUnits(units[i] ?? 0n, 18)
        };
      })
    );

    return NextResponse.json({
      supply: formatUnits(supply, 18),
      holdings,
      blockNumber: blockNumber.toString()
    } satisfies LiveBasket);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not read basket";
    return NextResponse.json({error: message}, {status: 502});
  }
}
