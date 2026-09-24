import Link from "next/link";
import {formatUnits} from "viem";
import {erc20Abi, thesisBasketAbi} from "@thesis/shared";
import type {LiveBasket} from "../../api/basket/route";
import {deployment, explorer, publicClient} from "../../chain";
import {Reveal} from "../../motion";
import LiveBasketView from "./LiveBasketView";

export const revalidate = 10;

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

  const initial: LiveBasket = {
    supply: formatUnits(supply, 18),
    holdings,
    blockNumber: blockNumber.toString()
  };

  return (
    <>
      <div className="aurora" aria-hidden="true" />
      <main>
        <header className="masthead">
          <Link className="wordmark" href="/">
            Thesis
          </Link>
          <span className="chip live">Live on X Layer · 196</span>
        </header>

        <section className="hero" style={{paddingBottom: 30}}>
          <Reveal>
            <Link className="chip" href="/" style={{marginBottom: 22, display: "inline-block"}}>
              ← All baskets
            </Link>
            <h1 style={{fontSize: "clamp(1.9rem, 5vw, 2.7rem)", maxWidth: "20ch"}}>{name}</h1>
            <p>&ldquo;{theme}&rdquo;</p>
          </Reveal>
        </section>

        <LiveBasketView
          basket={basket}
          symbol={symbol}
          quoteToken={deployment.quoteToken}
          constituents={constituents}
          initial={initial}
          explorerBase={explorer("")}
          builderCode={process.env.BUILDER_CODE}
        />

        <section className="section">
          <div className="section-head">
            <h2>Mechanics</h2>
          </div>
          <Reveal>
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
          </Reveal>
        </section>

        <section className="section">
          <div className="section-head">
            <h2>Addresses</h2>
          </div>
          <Reveal>
            <div className="card">
              <div className="row">
                <span>Basket</span>
                <a className="mono link" href={explorer(`address/${basket}`)}>
                  {basket}
                </a>
              </div>
              {holdings.map((holding) => (
                <div className="row" key={holding.address}>
                  <span>{holding.ticker}</span>
                  <a className="mono link" href={explorer(`address/${holding.address}`)}>
                    {holding.address}
                  </a>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        <p className="foot">
          Thesis · permissionless index launchpad for tokenized equities · OKX Dev Day 2026
        </p>
      </main>
    </>
  );
}
