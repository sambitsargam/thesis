import Link from "next/link";
import {formatUnits} from "viem";
import {XSTOCK_CATALOG} from "@thesis/shared/catalog";
import {loadBaskets, valueBaskets} from "./baskets";
import {deployment, explorer} from "./chain";
import BasketGallery from "./BasketGallery";
import HeroDiagram from "./HeroDiagram";
import MarketStrip from "./MarketStrip";
import {AnimatedNumber, Reveal} from "./motion";

export const revalidate = 15;

const STRIP_TICKERS = ["NVDAx", "AMDx", "TSMx", "ASMLx", "SPCXx", "TSLAx"];

export default async function Home() {
  const baskets = await loadBaskets();
  const valuations = await valueBaskets(baskets);

  const cards = baskets.map((basket) => ({
    address: basket.address,
    name: basket.name,
    symbol: basket.symbol,
    theme: basket.theme,
    tickers: basket.holdings.map((holding) => holding.ticker),
    creator: basket.creator,
    version: basket.version,
    feeBps: basket.feeBps,
    supply: formatUnits(basket.supply, 18)
  }));

  // The two figures that make the launchpad claim concrete: how many people launched
  // something, and how much real money those baskets hold.
  const creators = new Set(baskets.map((basket) => basket.creator.toLowerCase())).size;
  const valueHeld = baskets.reduce(
    (sum, basket) => sum + (valuations.get(basket.address)?.tvlUsd ?? 0),
    0
  );

  const strip = STRIP_TICKERS.map((ticker) => XSTOCK_CATALOG.find((t) => t.ticker === ticker))
    .filter((t): t is NonNullable<typeof t> => Boolean(t))
    .map((t) => ({ticker: t.ticker, name: t.name, address: t.address}));

  return (
    <>
      <main>
      <section className="hero">
        {/* Three direct children so the wide-screen grid has cells to place. */}
        <Reveal className="hero-copy">
          <h1>
            Anyone can <em>launch an index</em>.
          </h1>
          <p>
            Describe a theme in a sentence. Thesis deploys it as a single ERC-20, backed by
            real tokenized equities held on X Layer, and pays you a share of every mint. No
            approval, no listing process, and no owner — not even us.
          </p>
          <div className="hero-cta">
            <Link href="/launch">
              <span className="cta-button">Launch a basket →</span>
            </Link>
            <Link className="chip" href="/leaderboard">
              See what people launched
            </Link>
          </div>
        </Reveal>

        <HeroDiagram tickers={cards[0]?.tickers ?? ["NVDAx", "TSLAx", "SPYx"]} />

        <dl className="stats">
          <div className="stat">
            <dt>Baskets live</dt>
            <dd>
              <AnimatedNumber value={baskets.length} />
            </dd>
          </div>
          <div className="stat">
            <dt>Creators</dt>
            <dd>
              <AnimatedNumber value={creators} />
            </dd>
          </div>
          <div className="stat">
            <dt>Value held</dt>
            <dd>
              <AnimatedNumber value={valueHeld} decimals={2} prefix="$" />
            </dd>
          </div>
          <div className="stat">
            <dt>Equities available</dt>
            <dd>
              <AnimatedNumber value={XSTOCK_CATALOG.length} />
            </dd>
          </div>
        </dl>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Baskets</h2>
          <Link className="chip" href="/leaderboard">
            Leaderboard →
          </Link>
          <span className="note">
            Anyone can launch one.
            {deployment.factoryV2
              ? " Creators earn a capped fee and no special powers."
              : " The creator gets no special powers."}
          </span>
        </div>

        <BasketGallery baskets={cards} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Live market</h2>
          <span className="note">Priced through the same routes a mint uses</span>
        </div>
        <MarketStrip tokens={strip} />
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Why it is different</h2>
          <span className="note">Every other team built a fund. Thesis builds what makes them.</span>
        </div>
        <div className="pillars">
          <Reveal delay={0}>
            <div className="pillar">
              <span className="num">01</span>
              <h3>Not a fund. The factory.</h3>
              <p>
                Most products in this space are one fund, picked by one team. Thesis is the
                thing that makes funds: describe any theme and deploy your own index in a
                single transaction. No approval, no listing process, no gatekeeper — and no
                limit on how many exist.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="pillar">
              <span className="num">02</span>
              <h3>Creators get paid</h3>
              <p>
                Set a fee when you launch and earn it on every mint, forever. The contract
                caps it at 1% and makes it immutable, so a basket can never be turned
                against the people who bought it — not by its creator, and not by us.
              </p>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div className="pillar">
              <span className="num">03</span>
              <h3>Fully backed, always</h3>
              <p>
                Every share is a claim on real tokenized equities held by the contract.
                Nothing synthetic, no leverage, no oracle. The balances are on chain, so the
                backing is something you check rather than something we claim.
              </p>
            </div>
          </Reveal>
          <Reveal delay={240}>
            <div className="pillar">
              <span className="num">04</span>
              <h3>Nobody is in charge</h3>
              <p>
                No owner, no pause switch, no upgrade path. The creator of a basket gains no
                power over it, and the agent can rebalance but can never move value out. The
                contract enforces that, not a promise.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>How it works</h2>
          <span className="note">Theme to tradeable asset, then back to cash</span>
        </div>
        <Reveal>
          <div className="flow">
            <div className="flow-step">
              <span className="flow-num">1</span>
              <div>
                <div className="flow-title">Describe a theme</div>
                <div className="flow-body">
                  &ldquo;Nuclear power and grid modernisation.&rdquo; The agent searches
                  current coverage and proposes holdings with a reason for each, drawn only
                  from the {XSTOCK_CATALOG.length} equities live on X Layer.
                </div>
              </div>
            </div>
            <div className="flow-step">
              <span className="flow-num">2</span>
              <div>
                <div className="flow-title">Deploy the basket</div>
                <div className="flow-body">
                  One transaction deploys a fresh ERC-20. Every constituent is quoted first,
                  because weights are fixed at deployment and an unroutable holding would
                  make the basket permanently unmintable.
                </div>
              </div>
            </div>
            <div className="flow-step">
              <span className="flow-num">3</span>
              <div>
                <div className="flow-title">Buy in one click</div>
                <div className="flow-body">
                  Pay in USD₮0. The contract spends it in equal parts across every
                  constituent through Onchain OS Trade, measures what actually arrived, and
                  mints your shares against it.
                </div>
              </div>
            </div>
            <div className="flow-step">
              <span className="flow-num">4</span>
              <div>
                <div className="flow-title">Watch it drift, then rebalance</div>
                <div className="flow-body">
                  Equal weight is a statement about value, so a basket drifts as its
                  holdings move. The agent can trade it back — selling what grew, buying
                  what lagged — without value leaving the basket.
                </div>
              </div>
            </div>
            <div className="flow-step">
              <span className="flow-num">5</span>
              <div>
                <div className="flow-title">Sell back, your way</div>
                <div className="flow-body">
                  Redeem in kind and take the equities out, or sell the whole position back
                  to USD₮0 in a single transaction.
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Built on OKX</h2>
          <span className="note">Every piece is live on mainnet</span>
        </div>
        <Reveal>
          <div className="card">
            <div className="row">
              <span>X Layer</span>
              <span>Every contract deployed to chain 196. Gas paid in OKB</span>
            </div>
            <div className="row">
              <span>xStocks</span>
              <span>
                {XSTOCK_CATALOG.length} tokenized equities, held for real by each basket
              </span>
            </div>
            <div className="row">
              <span>Onchain OS Trade</span>
              <span>Fills every buy, sell and rebalance leg through the OKX aggregator</span>
            </div>
            <div className="row">
              <span>Builder Code</span>
              <span>ERC-8021 attribution on every transaction the app sends</span>
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
            <span>ThesisFactory V1</span>
            <a className="mono link" href={explorer(`address/${deployment.factory}`)}>
              {deployment.factory}
            </a>
          </div>
          {deployment.factoryV2 && (
            <div className="row">
              <span>ThesisFactory V2</span>
              <a className="mono link" href={explorer(`address/${deployment.factoryV2}`)}>
                {deployment.factoryV2}
              </a>
            </div>
          )}
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

      <section className="cta">
        <h2>Launch your own basket</h2>
        <p>
          Describe a theme in a sentence. Deploy it as a tradeable ERC-20 in one
          transaction. No approval, no listing process.
          {deployment.factoryV2
            ? " Earn your share of every mint, capped at 1% by the contract and fixed the moment it deploys."
            : " No fee beyond gas."}
        </p>
        <Link href="/launch">
          <span className="cta-button">Start with a theme →</span>
        </Link>
      </section>

      <p className="foot">
        Thesis · permissionless index launchpad for tokenized equities · OKX Dev Day 2026
      </p>
      </main>
    </>
  );
}
