"use client";

import {useEffect, useState} from "react";

export interface ResearchPick {
  ticker: string;
  address: `0x${string}`;
  name: string;
  reason: string;
}

export interface Briefing {
  theme: string;
  briefing: string;
  outlook: string;
  risks: string;
  sources: Array<{title: string; url: string}>;
  picks: ResearchPick[];
  basketName: string;
  symbol: string;
  searches: number;
  models: {search: string; select: string};
}

const STAGES = [
  "Searching the open web…",
  "Reading recent coverage…",
  "Identifying direct exposure…",
  "Matching against X Layer…",
  "Assembling the basket…"
];

/** Rotates through stages so a long request reads as progress, not a hang. */
export function ResearchProgress() {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="research-progress">
      {STAGES.map((label, i) => (
        <div key={label} className="step" data-state={i < stage ? "done" : i === stage ? "active" : "todo"}>
          <span className="dot">{i < stage ? "✓" : ""}</span>
          {label}
        </div>
      ))}
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

      <div className="preview-title" style={{marginTop: 18}}>Holdings and why</div>
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
