import type {Metadata} from "next";
import Link from "next/link";
import {formatUnits} from "viem";
import {erc20Abi, thesisBasketAbi, xLayer} from "@thesis/shared";
import type {LiveBasket} from "../../api/basket/route";
import {deployment, explorer, publicClient} from "../../chain";
import {Reveal} from "../../motion";
import LiveBasketView from "./LiveBasketView";
import ProofOfReserve, {type Reserve} from "./ProofOfReserve";
import ShareButton from "./ShareButton";

export const revalidate = 10;

/**
 * Display name: the issuer prefix and the weighting are stated elsewhere on the page.
 *
 * The on-chain name stays whole in the title tag and the share card; it is only the
 * heading that drops them, so the theme does not appear twice in two lines.
 */
const title = (name: string) =>
  name.replace(/^Thesis\s+/i, "").replace(/,?\s*equal weight$/i, "");

/**
 * Per-basket metadata so a shared link describes the actual theme.
 *
 * Paired with `opengraph-image.tsx`, pasting a basket anywhere unfurls with its
 * live holdings — the creator's pitch travels with the link.
 */
export async function generateMetadata({
  params
}: {
  params: Promise<{address: string}>;
}): Promise<Metadata> {
  const {address} = await params;
  try {
    const [name, theme, symbol] = await Promise.all([
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: thesisBasketAbi,
        functionName: "name"
      }),
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: thesisBasketAbi,
        functionName: "theme"
      }),
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: thesisBasketAbi,
        functionName: "symbol"
      })
    ]);
    const title = `${name} · ${symbol} — Thesis`;
    const description = `"${theme}" — a fully backed basket of tokenized equities on X Layer, mintable in one transaction.`;
    return {title, description, openGraph: {title, description, type: "website"}};
  } catch {
    return {title: "Basket — Thesis"};
  }
}

export default async function BasketPage({params}: {params: Promise<{address: string}>}) {
  const {address} = await params;
  const basket = address as `0x${string}`;

  const [name, symbol, theme, constituents, supply, nav, blockNumber] = await Promise.all([
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "name"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "symbol"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "theme"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "constituents"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "totalSupply"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "navPerShare"}),
    publicClient.getBlockNumber()
  ]);

  // Recorded in deployments.ts by the deploy script; env only overrides it.
  const zapAddress = ((process.env.ZAP_ADDRESS ??
    process.env.NEXT_PUBLIC_ZAP_ADDRESS ??
    deployment.zap) || undefined) as `0x${string}` | undefined;

  const agent = await publicClient.readContract({
    address: basket,
    abi: thesisBasketAbi,
    functionName: "agent"
  });

  // V1 baskets predate the creator fee and have no such function.
  const [feeBps, creator] = await Promise.all([
    publicClient
      .readContract({address: basket, abi: thesisBasketAbi, functionName: "feeBps"})
      .catch(() => 0n),
    publicClient
      .readContract({address: basket, abi: thesisBasketAbi, functionName: "creator"})
      .catch(() => undefined)
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
        raw: held.toString(),
        held: formatUnits(held, 18),
        perShare: formatUnits(units[i] ?? 0n, 18)
      };
    })
  );

  const initial: LiveBasket = {
    supply: formatUnits(supply, 18),
    // `raw` is for the proof panel only; the live view works in whole tokens.
    holdings: holdings.map(({raw: _raw, ...holding}) => holding),
    blockNumber: blockNumber.toString()
  };

  const reserves: Reserve[] = holdings.map((holding) => ({
    ticker: holding.ticker,
    token: holding.address,
    raw: holding.raw,
    amount: holding.held
  }));

  return (
    <>
      <main>
        <section className="hero" style={{paddingBottom: 30}}>
          <Reveal>
            <Link className="chip" href="/" style={{marginBottom: 22, display: "inline-block"}}>
              ← All baskets
            </Link>
            <h1 style={{fontSize: "clamp(2.1rem, 4.4vw, 3.1rem)", maxWidth: "26ch"}}>
              {title(name)}
            </h1>
            {title(theme).trim().toLowerCase() !== title(name).trim().toLowerCase() && (
              <p>&ldquo;{theme}&rdquo;</p>
            )}
            {creator && (
              <p className="byline">
                Launched by{" "}
                <a className="mono link" href={explorer(`address/${creator}`)}>
                  {creator.slice(0, 6)}…{creator.slice(-4)}
                </a>
                {feeBps > 0n
                  ? `, who earns ${Number(feeBps) / 100}% of every mint and controls nothing else.`
                  : ", who charges nothing and controls nothing."}
              </p>
            )}
            {/*
              Fork is the action that makes this a launchpad rather than a fund, so it is
              a button here and not a chip among chips. Sharing is secondary to it.
            */}
            <div className="controls" style={{marginTop: 22}}>
              <Link className="fork-cta" href={`/launch?from=${basket}`}>
                Fork this basket →
              </Link>
              <ShareButton name={name} theme={theme} />
            </div>
            <p className="controls-note">
              Forking copies these holdings into your own basket, with your own fee. This
              one is untouched by it, and anyone with the link can buy either.
            </p>
          </Reveal>
        </section>

        <LiveBasketView
          zap={zapAddress}
          basket={basket}
          symbol={symbol}
          quoteToken={deployment.quoteToken}
          constituents={constituents}
          initial={initial}
          agent={agent}
          feeBps={feeBps}
          creator={creator}
          explorerBase={explorer("")}
        />

        <section className="section">
          <div className="section-head">
            <h2>How this basket works</h2>
          </div>
          <Reveal>
            <div className="card">
              <div className="row">
                <span>Backing</span>
                <span>The contract holds the real tokenized equities, one for one</span>
              </div>
              <div className="row">
                <span>Redemption</span>
                <span>Sell your shares back for your exact portion of what it holds</span>
              </div>
              <div className="row">
                <span>Rebalance</span>
                <span>The agent can trade it back to equal weight. It cannot take anything out</span>
              </div>
              <div className="row">
                <span>Control</span>
                <span>Nobody owns it, nobody can pause it, and the holdings were set when it deployed</span>
              </div>
            </div>
          </Reveal>
        </section>

        <ProofOfReserve
          basket={basket}
          symbol={symbol}
          reserves={reserves}
          blockNumber={blockNumber.toString()}
          rpcUrl={xLayer.rpcUrls.default.http[0]}
          explorerBase={explorer("")}
        />

        <p className="foot">
          Thesis · permissionless index launchpad for tokenized equities · OKX Dev Day 2026
        </p>
      </main>
    </>
  );
}
