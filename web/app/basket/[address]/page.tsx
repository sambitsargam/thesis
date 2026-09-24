import Link from "next/link";
import {formatUnits} from "viem";
import {erc20Abi, thesisBasketAbi} from "@thesis/shared";
import {deployment, explorer, publicClient} from "../../chain";
import MintPanel from "./MintPanel";

export const revalidate = 15;

export default async function BasketPage({params}: {params: Promise<{address: string}>}) {
  const {address} = await params;
  const basket = address as `0x${string}`;

  const [name, symbol, theme, constituents, supply, nav] = await Promise.all([
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "name"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "symbol"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "theme"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "constituents"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "totalSupply"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "navPerShare"})
  ]);

  const tickers = await Promise.all(
    constituents.map((token) =>
      publicClient
        .readContract({address: token, abi: erc20Abi, functionName: "symbol"})
        .catch(() => token.slice(0, 8))
    )
  );

  const [, units] = nav;
  const weight = 10_000 / constituents.length;

  return (
    <main>
      <header className="masthead">
        <Link className="wordmark" href="/">
          Thesis
        </Link>
        <span className="chip live">● Live on X Layer · 196</span>
      </header>

      <section className="hero" style={{paddingBottom: 32}}>
        <Link className="chip" href="/" style={{marginBottom: 22, display: "inline-block"}}>
          ← All baskets
        </Link>
        <h1 style={{fontSize: "clamp(1.9rem, 5vw, 2.7rem)", maxWidth: "20ch"}}>{name}</h1>
        <p>&ldquo;{theme}&rdquo;</p>

        <dl className="stats">
          <div className="stat">
            <dt>Symbol</dt>
            <dd>{symbol}</dd>
          </div>
          <div className="stat">
            <dt>Constituents</dt>
            <dd>{constituents.length}</dd>
          </div>
          <div className="stat">
            <dt>Each weighted</dt>
            <dd>{(weight / 100).toFixed(2)}%</dd>
          </div>
          <div className="stat">
            <dt>Shares out</dt>
            <dd>{formatUnits(supply, 18).replace(/\.0+$/, "")}</dd>
          </div>
        </dl>
      </section>

      <section className="section" style={{marginTop: 32}}>
        <MintPanel
          basket={basket}
          symbol={symbol}
          quoteToken={deployment.quoteToken}
          constituents={constituents}
          supplyIsZero={supply === 0n}
          builderCode={process.env.BUILDER_CODE}
        />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Holdings</h2>
          <span className="note">
            {supply === 0n ? "Nothing minted yet" : "Per one whole share"}
          </span>
        </div>
        <div className="card">
          {constituents.map((token, i) => (
            <div className="holding" key={token}>
              <div className="holding-top">
                <span className="holding-name">{tickers[i]}</span>
                <span className="holding-units">
                  {units[i] === undefined || units[i] === 0n
                    ? "—"
                    : `${Number(formatUnits(units[i], 18)).toPrecision(6)} / share`}
                </span>
              </div>
              <div className="holding-bar">
                <i style={{width: `${weight / 100}%`}} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Mechanics</h2>
        </div>
        <div className="card">
          <div className="row">
            <span>Backing</span>
            <span>Fully backed — the contract holds the real tokenized equities</span>
          </div>
          <div className="row">
            <span>Redemption</span>
            <span>Burn shares, receive the underlying pro rata, no price needed</span>
          </div>
          <div className="row">
            <span>Rebalance</span>
            <span>Agent-triggered; value cannot leave the basket</span>
          </div>
          <div className="row">
            <span>Control</span>
            <span>No owner, no pause, no upgrade. Constituents fixed at deployment</span>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Addresses</h2>
        </div>
        <div className="card">
          <div className="row">
            <span>Basket</span>
            <a className="mono link" href={explorer(`address/${basket}`)}>
              {basket}
            </a>
          </div>
          {constituents.map((token, i) => (
            <div className="row" key={token}>
              <span>{tickers[i]}</span>
              <a className="mono link" href={explorer(`address/${token}`)}>
                {token}
              </a>
            </div>
          ))}
        </div>
      </section>

      <p className="foot">
        Thesis · permissionless index launchpad for tokenized equities · OKX Dev Day 2026
      </p>
    </main>
  );
}
