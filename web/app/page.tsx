import Link from "next/link";
import {formatUnits} from "viem";
import {erc20Abi, thesisBasketAbi, thesisFactoryAbi} from "@thesis/shared";
import {XSTOCK_CATALOG} from "@thesis/shared/catalog";
import {deployment, explorer, publicClient} from "./chain";
import BasketGallery from "./BasketGallery";
import HeroDiagram from "./HeroDiagram";
import MarketStrip from "./MarketStrip";
import {AnimatedNumber, Reveal} from "./motion";

export const revalidate = 15;

const STRIP_TICKERS = ["NVDAx", "AMDx", "TSMx", "ASMLx", "SPCXx", "TSLAx"];

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

      const creator = await publicClient.readContract({
        address: deployment.factory,
        abi: thesisFactoryAbi,
        functionName: "creatorOf",
        args: [address]
      });

      const tickers = await Promise.all(
        constituents.map((token) =>
          publicClient
            .readContract({address: token, abi: erc20Abi, functionName: "symbol"})
            .catch(() => "?")
        )
      );

      return {address, name, symbol, theme, tickers, creator, supply: formatUnits(supply, 18)};
    })
  );
}

export default async function Home() {
  const baskets = await loadBaskets();
  const totalConstituents = baskets.reduce((n, b) => n + b.tickers.length, 0);

  const totalShares = baskets.reduce((n, b) => n + Number(b.supply), 0);

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
            Turn a theme into <em>one holdable asset</em>.
          </h1>
          <p>
            Buying a diversified position in tokenized equities means many swaps, many fees
            and manual rebalancing forever. Thesis deploys the whole basket as a single
            ERC-20 — fully backed, minted in one transaction, redeemable for the underlying
            at any time.
          </p>
        </Reveal>

        <HeroDiagram tickers={baskets[0]?.tickers ?? ["NVDAx", "TSLAx", "SPYx"]} />

        <dl className="stats">
          <div className="stat">
            <dt>Baskets live</dt>
            <dd>
              <AnimatedNumber value={baskets.length} />
            </dd>
          </div>
          <div className="stat">
            <dt>Equities available</dt>
            <dd>
              <AnimatedNumber value={XSTOCK_CATALOG.length} />
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
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Baskets</h2>
          <span className="note">Anyone can launch one. The creator gets no special powers.</span>
        </div>

        <BasketGallery baskets={baskets} />
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
        </div>
        <div className="pillars">
          <Reveal delay={0}>
            <div className="pillar">
              <span className="num">01</span>
              <h3>Research, not vibes</h3>
              <p>
                Describe a theme and the agent searches the open web, cites what it read,
                and explains every holding. Selection is constrained to equities that
                actually exist on X Layer, so nothing it picks can be imaginary.
              </p>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <div className="pillar">
              <span className="num">02</span>
              <h3>Fully backed, always</h3>
              <p>
                Every share is a claim on real tokenized equities held by the contract.
                Nothing synthetic, no leverage, no oracle. Redeem at any time and the
                underlying comes back to your wallet.
              </p>
            </div>
          </Reveal>
          <Reveal delay={160}>
            <div className="pillar">
              <span className="num">03</span>
              <h3>Nobody is in charge</h3>
              <p>
                No owner, no pause switch, no upgrade path. The creator of a basket gains
                no power over it, and the agent can rebalance but can never move value
                out. The contract enforces that, not a promise.
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

      <section className="cta">
        <h2>Launch your own basket</h2>
        <p>
          Describe a theme in a sentence. Deploy it as a tradeable ERC-20 in one
          transaction. No approval, no listing process, no fee beyond gas.
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
