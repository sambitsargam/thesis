"use client";

import {useEffect, useState} from "react";

export interface ResearchPick {
  ticker: string;
  address: `0x${string}`;
  name: string;
  reason: string;
}

export interface Rejection {
  ticker: string;
  reason: string;
}

export interface Briefing {
  theme: string;
  briefing: string;
  outlook: string;
  risks: string;
  sources: Array<{title: string; url: string}>;
  picks: ResearchPick[];
  rejected: Rejection[];
  basketName: string;
  symbol: string;
  searches: number;
  models: {search: string; select: string};
}

/*
 * The wait is about fifteen seconds. Rather than animate invented progress through
 * stages nobody can observe, this shows the two things that are true the whole time:
 * what is being researched, and the universe it is allowed to choose from.
 *
 * That universe is the safety argument. A model can propose anything it likes; only
 * these can enter a basket. When the answer lands, the accepted and refused tickers
 * resolve against this same list — see `CatalogueCheck`.
 */
export function ResearchProgress({theme}: {theme: string}) {
  const [seconds, setSeconds] = useState(0);
  const [universe, setUniverse] = useState<string[]>([]);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/tokens");
        if (!response.ok) return;
        const body = (await response.json()) as {tokens?: Array<{ticker: string}>};
        if (!cancelled && body.tokens) setUniverse(body.tokens.map((t) => t.ticker));
      } catch {
        // The count below is the point; the grid is illustration.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="researching">
      <p className="researching-line">
        Reading current coverage of <em>{theme}</em>
        <span className="researching-clock">{seconds}s</span>
      </p>

      <p className="researching-note">
        Whatever it finds, it may only choose from the{" "}
        {universe.length > 0 ? universe.length : "44"} tokenized equities that actually
        trade on X Layer:
      </p>

      <div className="universe">
        {universe.map((ticker) => (
          <span key={ticker}>{ticker}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * What survived the catalogue check, and what did not.
 *
 * This is the one orchestrated moment in the interface: rows resolve in sequence, so a
 * refusal is visibly a step the system took rather than a static label.
 */
export function CatalogueCheck({data}: {data: Briefing}) {
  const rows = [
    ...data.rejected.map((item) => ({
      key: `x-${item.ticker}`,
      ticker: item.ticker,
      note: item.reason,
      kept: false
    })),
    ...data.picks.map((pick) => ({
      key: pick.address,
      ticker: pick.ticker,
      note: pick.name,
      kept: true
    }))
  ];

  return (
    <div className="check">
      <div className="preview-title">Checked against X Layer</div>
      {rows.map((row, i) => (
        <div
          className={`check-row ${row.kept ? "kept" : "refused"}`}
          key={row.key}
          style={{animationDelay: `${i * 90}ms`}}
        >
          <span className="check-mark">{row.kept ? "✓" : "✕"}</span>
          <span className="check-ticker">{row.ticker}</span>
          <span className="check-note">{row.note}</span>
        </div>
      ))}
      {data.rejected.length > 0 && (
        <p className="check-foot">
          {data.rejected.length === 1 ? "One proposal was" : `${data.rejected.length} proposals were`}{" "}
          refused. A ticker that does not trade on X Layer cannot enter a basket, so an
          invented one changes nothing.
        </p>
      )}
    </div>
  );
}

export function BriefingCard({data}: {data: Briefing}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="briefing">
      <div className="briefing-head">
        <div>
          <div className="card-title">{data.basketName}</div>
          <div className="card-theme">
            {data.searches} web search{data.searches === 1 ? "" : "es"} · {data.picks.length} holdings ·{" "}
            {(100 / data.picks.length).toFixed(2)}% each
          </div>
        </div>
        <span className="ticker">THESIS-{data.symbol}</span>
      </div>

      <div className="briefing-grid">
        <div>
          <div className="preview-title">Outlook</div>
          <p className="briefing-text">{data.outlook}</p>
        </div>
        <div>
          <div className="preview-title">Risks</div>
          <p className="briefing-text">{data.risks}</p>
        </div>
      </div>

      <CatalogueCheck data={data} />

      <div className="preview-title" style={{marginTop: 18}}>Why each holding is here</div>
      <div className="why">
        {data.picks.map((pick) => (
          <div className="why-row" key={pick.address}>
            <span className="why-ticker">{pick.ticker}</span>
            <span className="why-reason">{pick.reason}</span>
          </div>
        ))}
      </div>

      {data.sources.length > 0 && (
        <>
          <div className="preview-title" style={{marginTop: 18}}>
            Sources ({data.sources.length})
          </div>
          <ul className="sources">
            {data.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      <button className="linkish" style={{marginTop: 14}} onClick={() => setOpen(!open)}>
        {open ? "Hide the full briefing" : "Read the full briefing"}
      </button>
      {open && <p className="briefing-full">{data.briefing}</p>}

      <p className="disclaimer">
        Research summary generated from public sources, not investment advice. Verify
        anything you act on.
      </p>
    </div>
  );
}
