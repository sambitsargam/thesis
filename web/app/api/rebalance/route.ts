import {NextResponse} from "next/server";
import {formatUnits, parseUnits} from "viem";
import {erc20Abi, thesisBasketAbi} from "@thesis/shared";
import {fetchSwapQuotes} from "@thesis/shared/okx";
import {deployment, publicClient} from "../../chain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CHAIN_ID = 196;
const PROBE = 10_000_000n; // 10 USD₮0, to price each constituent.
const MIN_DRIFT_BPS = 25; // Below a quarter percent, trading costs more than it fixes.

interface Leg {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: string;
  minAmountOut: string;
  swapData: `0x${string}`;
}

/**
 * Plans a rebalance back to equal weight.
 *
 * Weights are value-based and there is no oracle on chain, so the basket cannot
 * compute this itself. Prices come from executable OKX routes; the contract still
 * enforces that every leg carries a floor and that no value leaves the basket.
 */
export async function POST(request: Request) {
  try {
    const {basket: basketAddress} = (await request.json()) as {basket: string};
    const basket = basketAddress as `0x${string}`;

    const constituents = await publicClient.readContract({
      address: basket,
      abi: thesisBasketAbi,
      functionName: "constituents"
    });

    const held = await Promise.all(
      constituents.map((token) =>
        publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [basket]
        })
      )
    );

    // Price every constituent by asking what 10 USD₮0 buys, then inverting.
    const priceQuotes = await fetchSwapQuotes(
      constituents.map((token) => ({token, amount: PROBE})),
      {
        chainId: CHAIN_ID,
        fromToken: deployment.quoteToken,
        slippagePercent: "1",
        holder: deployment.router
      }
    );

    const rows = constituents.map((token, i) => {
      const out = Number(priceQuotes[i]!.expectedOut) / 1e18;
      const price = out > 0 ? 10 / out : 0;
      const amount = Number(formatUnits(held[i]!, 18));
      return {token, ticker: "", price, amount, value: price * amount};
    });

    const total = rows.reduce((sum, r) => sum + r.value, 0);
    if (total <= 0) return NextResponse.json({error: "The basket holds nothing to rebalance."}, {status: 400});

    const target = total / rows.length;
    const drifts = rows.map((r) => ({
      ...r,
      driftBps: Math.round(((r.value - target) / total) * 10_000)
    }));

    const overweight = drifts.filter((d) => d.value > target).sort((a, b) => b.value - a.value);
    const underweight = drifts.filter((d) => d.value < target).sort((a, b) => a.value - b.value);
    const worst = Math.max(...drifts.map((d) => Math.abs(d.driftBps)));

    if (worst < MIN_DRIFT_BPS) {
      return NextResponse.json({
        legs: [],
        drifts: drifts.map((d) => ({token: d.token, driftBps: d.driftBps, value: d.value})),
        reason: "Already within a quarter percent of equal weight."
      });
    }

    // Pair the most overweight against the most underweight, largest first.
    const legs: Leg[] = [];
    const sells: Array<{token: `0x${string}`; usd: number; price: number}> = [];
    let ui = 0;
    for (const over of overweight) {
      let surplus = over.value - target;
      while (surplus > 0.01 && ui < underweight.length) {
        const under = underweight[ui]!;
        const need = target - under.value - (sells.find((s) => s.token === under.token)?.usd ?? 0);
        if (need <= 0.01) {
          ui += 1;
          continue;
        }
        const usd = Math.min(surplus, need);
        sells.push({token: over.token, usd, price: over.price});
        legs.push({
          tokenIn: over.token,
          tokenOut: under.token,
          amountIn: parseUnits((usd / over.price).toFixed(18), 18).toString(),
          minAmountOut: "1",
          swapData: "0x"
        });
        surplus -= usd;
        if (usd >= need - 0.01) ui += 1;
      }
    }

    if (legs.length === 0) {
      return NextResponse.json({legs: [], drifts: [], reason: "Nothing worth trading."});
    }

    // Quote each leg for real calldata, selling the overweight into the underweight.
    const quotes = await fetchSwapQuotes(
      legs.map((leg) => ({token: leg.tokenOut, amount: BigInt(leg.amountIn), from: leg.tokenIn})),
      {
        chainId: CHAIN_ID,
        fromToken: deployment.quoteToken,
        slippagePercent: "1",
        holder: basket
      }
    );

    const planned = legs.map((leg, i) => ({
      ...leg,
      swapData: quotes[i]!.data,
      // A floor of 99% of the quote: enough to block a bad fill, loose enough to land.
      minAmountOut: ((quotes[i]!.expectedOut * 99n) / 100n || 1n).toString()
    }));

    return NextResponse.json({
      legs: planned,
      drifts: drifts.map((d) => ({token: d.token, driftBps: d.driftBps, value: d.value})),
      worstDriftBps: worst
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not plan a rebalance";
    return NextResponse.json({error: message}, {status: 502});
  }
}
