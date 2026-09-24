import Link from "next/link";
import {formatUnits} from "viem";
import {erc20Abi, thesisBasketAbi, thesisFactoryAbi} from "@thesis/shared";
import {deployment, explorer, publicClient} from "./chain";
import {AnimatedNumber, Reveal} from "./motion";

export const revalidate = 15;

async function loadBaskets() {
  const addresses = await publicClient.readContract({
    address: deployment.factory,
    abi: thesisFactoryAbi,
    functionName: "baskets"
  });

  return Promise.all(
    addresses.map(async (address) => {
      const [name, symbol, theme, constituents, supply] = await Promise.all([
        publicClient.readContract({address, abi: thesisBasketAbi, functionName: "name"}),
        publicClient.readContract({address, abi: thesisBasketAbi, functionName: "symbol"}),
        publicClient.readContract({address, abi: thesisBasketAbi, functionName: "theme"}),
        publicClient.readContract({address, abi: thesisBasketAbi, functionName: "constituents"}),
        publicClient.readContract({address, abi: thesisBasketAbi, functionName: "totalSupply"})
      ]);

      const tickers = await Promise.all(
        constituents.map((token) =>
          publicClient
            .readContract({address: token, abi: erc20Abi, functionName: "symbol"})
            .catch(() => "?")
        )
      );

      return {address, name, symbol, theme, tickers, supply};
    })
  );
}

export default async function Home() {
  const baskets = await loadBaskets();
  const totalConstituents = baskets.reduce((n, b) => n + b.tickers.length, 0);

  const totalShares = baskets.reduce((n, b) => n + Number(formatUnits(b.supply, 18)), 0);

  return (
    <>
      <main>
      <section className="hero">
        <Reveal>
        <h1>
          Turn a theme into <em>one holdable asset</em>.
        </h1>
        <p>
          Buying a diversified position in tokenized equities means many swaps, many fees and
          manual rebalancing forever. Thesis deploys the whole basket as a single ERC-20 —
          fully backed, minted in one transaction, redeemable for the underlying at any time.
        </p>

        <dl className="stats">
          <div className="stat">
            <dt>Baskets live</dt>
            <dd>
              <AnimatedNumber value={baskets.length} />
            </dd>
          </div>
          <div className="stat">
            <dt>Equities held</dt>
            <dd>
              <AnimatedNumber value={totalConstituents} />
            </dd>
          </div>
          <div className="stat">
            <dt>Shares minted</dt>
            <dd>
              <AnimatedNumber value={totalShares} decimals={totalShares === 0 ? 0 : 3} />
            </dd>
          </div>
          <div className="stat">
            <dt>Backing</dt>
            <dd>1:1 real</dd>
          </div>
        </dl>
        </Reveal>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Baskets</h2>
          <span className="note">Anyone can launch one. The creator gets no special powers.</span>
        </div>

        {baskets.length === 0 ? (
          <div className="card">
            <div className="card-theme">No baskets deployed yet.</div>
          </div>
        ) : (
          baskets.map((basket, i) => (
            <Reveal key={basket.address} delay={i * 80}>
            <Link className="card" href={`/basket/${basket.address}`}>
              <div className="card-head">
                <div>
                  <div className="card-title">{basket.name}</div>
                  <div className="card-theme">&ldquo;{basket.theme}&rdquo;</div>
                </div>
                <span className="ticker">{basket.symbol}</span>
              </div>

              <div className="weights">
                {basket.tickers.map((ticker) => (
                  <span key={ticker} style={{flex: 1}} />
                ))}
              </div>

              <div className="pills">
                {basket.tickers.map((ticker) => (
                  <span className="pill" key={ticker}>
                    {ticker}
                  </span>
                ))}
                <span className="pill">
                  {formatUnits(basket.supply, 18).replace(/\.0+$/, "")} shares
                </span>
              </div>
            </Link>
            </Reveal>
          ))
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>How a mint works</h2>
        </div>
        <Reveal>
        <div className="card">
          <div className="row">
            <span>1 · Quote</span>
            <span>Onchain OS Trade prices each leg off-chain and returns calldata</span>
          </div>
          <div className="row">
            <span>2 · Buy</span>
            <span>The basket spends your USD₮0 in equal parts across every constituent</span>
          </div>
          <div className="row">
            <span>3 · Verify</span>
            <span>Fills are measured on chain, not trusted — a bad route reverts</span>
          </div>
          <div className="row">
            <span>4 · Hold</span>
            <span>You receive one ERC-20 backed by the equities the basket now owns</span>
          </div>
        </div>
        </Reveal>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Contracts</h2>
          <span className="note">Verifiable on OKLink</span>
        </div>
        <div className="card">
          <div className="row">
            <span>ThesisFactory</span>
            <a className="mono link" href={explorer(`address/${deployment.factory}`)}>
              {deployment.factory}
            </a>
          </div>
          <div className="row">
            <span>OkxTradeRouter</span>
            <a className="mono link" href={explorer(`address/${deployment.router}`)}>
              {deployment.router}
            </a>
          </div>
          <div className="row">
            <span>Quote token</span>
            <a className="mono link" href={explorer(`address/${deployment.quoteToken}`)}>
              USD₮0
            </a>
          </div>
          <div className="row">
            <span>OKX DexRouter</span>
            <a className="mono link" href={explorer(`address/${deployment.okxDexRouter}`)}>
              {deployment.okxDexRouter}
            </a>
          </div>
        </div>
      </section>

      <p className="foot">
        Thesis · permissionless index launchpad for tokenized equities · OKX Dev Day 2026
      </p>
      </main>
    </>
  );
}
