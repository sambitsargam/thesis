import {NextResponse} from "next/server";
import {formatUnits} from "viem";
import {erc20Abi, thesisBasketAbi} from "@thesis/shared";
import {deployment, publicClient} from "../../chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Quote-token balance, plus basket shares when a basket is named. */
export async function POST(request: Request) {
  try {
    const {account, basket} = (await request.json()) as {account: string; basket?: string};
    const holder = account as `0x${string}`;

    const quote = await publicClient.readContract({
      address: deployment.quoteToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [holder]
    });

    let shares = "0";
    if (basket) {
      const balance = await publicClient.readContract({
        address: basket as `0x${string}`,
        abi: thesisBasketAbi,
        functionName: "balanceOf",
        args: [holder]
      });
      shares = formatUnits(balance, 18);
    }

    return NextResponse.json({quote: formatUnits(quote, 6), shares});
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not read balances";
    return NextResponse.json({error: message}, {status: 502});
  }
}
