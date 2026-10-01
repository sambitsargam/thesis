import Link from "next/link";
import {formatUnits} from "viem";
import {loadBaskets, valueBaskets} from "../baskets";
import {explorer} from "../chain";
import {Reveal} from "../motion";
import LeaderboardTable, {type Row} from "./LeaderboardTable";

export const revalidate = 30;

export const metadata = {
  title: "Leaderboard — Thesis",
  description:
    "Every basket launched on Thesis, ranked by what it holds, what has been paid into it, and what its creator has earned."
};

const QUOTE_DECIMALS = 6;

export default async function LeaderboardPage() {
  const baskets = await loadBaskets();
  const valuations = await valueBaskets(baskets);

  const rows: Row[] = baskets.map((basket) => ({
    address: basket.address,
    name: basket.name,
    symbol: basket.symbol,
    theme: basket.theme,
    tickers: basket.holdings.map((holding) => holding.ticker),
    creator: basket.creator,
    version: basket.version,
    feeBps: basket.feeBps,
    moneyIn: basket.counters
      ? Number(formatUnits(basket.counters.quoteIn, QUOTE_DECIMALS))
      : null,
    mints: basket.counters ? basket.counters.mints : null,
    creatorEarned: basket.counters
      ? Number(formatUnits(basket.counters.creatorFees, QUOTE_DECIMALS))
      : null,
    tvlUsd: valuations.get(basket.address)?.tvlUsd ?? null
  }));

  // Who is actually making money here — the most launchpad-shaped fact on the page.
  const earnings = new Map<string, {earned: number; baskets: number}>();
  for (const row of rows) {
    const key = row.creator.toLowerCase();
    const current = earnings.get(key) ?? {earned: 0, baskets: 0};
    earnings.set(key, {
      earned: current.earned + (row.creatorEarned ?? 0),
      baskets: current.baskets + 1
    });
  }
  const [topCreator] = [...earnings.entries()]
    .filter(([, totals]) => totals.earned > 0)
    .sort((a, b) => b[1].earned - a[1].earned);

  const priced = rows.filter((row) => row.tvlUsd !== null);
  const totalTvl = priced.reduce((sum, row) => sum + row.tvlUsd!, 0);
  const counted = rows.filter((row) => row.mints !== null);
  const totalMints = counted.reduce((sum, row) => sum + row.mints!, 0);
  const creators = new Set(rows.map((row) => row.creator.toLowerCase())).size;

  return (
    <main>
      <section className="hero" style={{paddingBottom: 30}}>
        <Reveal>
          <Link className="chip" href="/" style={{marginBottom: 22, display: "inline-block"}}>
            ← All baskets
          </Link>
          <h1 style={{fontSize: "clamp(1.9rem, 5vw, 2.7rem)", maxWidth: "20ch"}}>
            Every index anyone has launched
          </h1>
          <p>
            Ranked by what each basket actually holds. Every number here is read from the
            contracts themselves — the totals are kept on chain by the baskets, not by a
            database we run, so you can check any of them yourself.
          </p>
        </Reveal>

        <dl className="stats">
          <div className="stat">
            <dt>Baskets</dt>
            <dd>{rows.length}</dd>
          </div>
          <div className="stat">
            <dt>Creators</dt>
            <dd>{creators}</dd>
          </div>
          <div className="stat">
            <dt>Value held</dt>
            <dd>${totalTvl.toFixed(2)}</dd>
          </div>
          <div className="stat">
            <dt>Mints</dt>
            <dd>{counted.length === 0 ? "—" : totalMints}</dd>
          </div>
        </dl>
      </section>

      {topCreator && (
        <section className="section" style={{marginTop: 8, marginBottom: 0}}>
          <Reveal>
            <div className="card">
              <div className="row">
                <span>Top creator</span>
                <span>
                  <a className="mono link" href={explorer(`address/${topCreator[0]}`)}>
                    {topCreator[0].slice(0, 6)}…{topCreator[0].slice(-4)}
                  </a>{" "}
                  — ${topCreator[1].earned.toFixed(4)} earned across{" "}
                  {topCreator[1].baskets} basket{topCreator[1].baskets === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          </Reveal>
        </section>
      )}

      <section className="section" style={{marginTop: 8}}>
        {rows.length === 0 ? (
          <div className="card">
            <div className="card-theme">
              No baskets yet. <Link href="/launch">Launch the first one →</Link>
            </div>
          </div>
        ) : (
          <LeaderboardTable rows={rows} explorerBase={explorer("")} />
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>How these numbers are made</h2>
        </div>
        <Reveal>
          <div className="card">
            <div className="row">
              <span>Value held</span>
              <span>
                The contract&rsquo;s real token balances, priced through the same OKX routes a
                mint would use
              </span>
            </div>
            <div className="row">
              <span>Money in</span>
              <span>
                <span className="mono">totalQuoteIn</span> — cumulative USD₮0 ever paid into the basket, kept on chain
              </span>
            </div>
            <div className="row">
              <span>Mints</span>
              <span>
                <span className="mono">mintCount</span> — incremented by the contract itself, never by us
              </span>
            </div>
            <div className="row">
              <span>Creator earned</span>
              <span>
                <span className="mono">totalCreatorFees</span> — equal to what the creator actually received
              </span>
            </div>
            <div className="row">
              <span>Shown as —</span>
              <span>
                A basket from the original V1 factory, which predates these counters, or a
                holding the aggregator could not price just now
              </span>
            </div>
          </div>
        </Reveal>
      </section>

      <section className="cta">
        <h2>Your theme could be on this list</h2>
        <p>
          Describe it in a sentence, pick the equities, deploy in one transaction. Anyone who
          buys it pays your fee.
        </p>
        <Link href="/launch">
          <span className="cta-button">Launch a basket →</span>
        </Link>
      </section>

      <p className="foot">
        Thesis · permissionless index launchpad for tokenized equities · OKX Dev Day 2026
      </p>
    </main>
  );
}
