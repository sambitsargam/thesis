"use client";

import Link from "next/link";
import {useState} from "react";
import {Reveal} from "../motion";
import {useWallet} from "../WalletProvider";

export interface Row {
  address: string;
  name: string;
  symbol: string;
  theme: string;
  tickers: string[];
  creator: string;
  version: 1 | 2;
  feeBps: number;
  /** Null on baskets deployed before the counters existed. */
  moneyIn: number | null;
  mints: number | null;
  creatorEarned: number | null;
  /** Null when any constituent could not be priced. */
  tvlUsd: number | null;
}

type SortKey = "tvlUsd" | "moneyIn" | "mints" | "creatorEarned";

const SORTS: {key: SortKey; label: string}[] = [
  {key: "tvlUsd", label: "Value held"},
  {key: "moneyIn", label: "Money in"},
  {key: "mints", label: "Mints"},
  {key: "creatorEarned", label: "Creator earned"}
];

function usd(n: number): string {
  if (n >= 1000) return `$${Math.round(n).toLocaleString("en-US")}`;

  // A first creator fee is fractions of a cent, and rounding it to $0.01 would overstate
  // the one number a creator checks against their own wallet. Below four decimals there
  // is nothing left to show, so dust reads as zero rather than as "$0.0000".
  if (n > 0 && n < 0.01) {
    const fine = n.toFixed(4);
    return Number(fine) === 0 ? "$0.00" : `$${fine}`;
  }

  return `$${n.toFixed(2)}`;
}

export default function LeaderboardTable({rows, explorerBase}: {rows: Row[]; explorerBase: string}) {
  const {account} = useWallet();
  const [sort, setSort] = useState<SortKey>("tvlUsd");

  // Unranked baskets sort last whichever column is chosen, rather than tying at zero.
  const ranked = [...rows].sort((a, b) => {
    const left = a[sort];
    const right = b[sort];
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left;
  });

  return (
    <>
      <div className="pills" style={{marginBottom: 16}}>
        {SORTS.map((option) => (
          <button
            key={option.key}
            className="pill"
            aria-pressed={sort === option.key}
            onClick={() => setSort(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="board">
        {ranked.map((row, i) => {
          const mine = Boolean(account) && row.creator.toLowerCase() === account!.toLowerCase();
          return (
            <Reveal key={row.address} delay={i * 50}>
              <div className="board-row">
                <div className="board-rank">{i + 1}</div>

                <div className="board-main">
                  <Link className="board-name" href={`/basket/${row.address}`}>
                    {row.name}
                    {mine && <span className="mine">Yours</span>}
                  </Link>
                  <div className="board-theme">&ldquo;{row.theme}&rdquo;</div>
                  <div className="pills" style={{marginTop: 10}}>
                    <span className="pill">{row.symbol}</span>
                    {row.tickers.map((ticker) => (
                      <span className="pill" key={ticker}>
                        {ticker}
                      </span>
                    ))}
                    {row.version === 1 && <span className="pill">V1</span>}
                  </div>
                </div>

                <dl className="board-stats">
                  <div className="stat">
                    <dt>Value held</dt>
                    <dd className="tnum">{row.tvlUsd === null ? "—" : usd(row.tvlUsd)}</dd>
                  </div>
                  <div className="stat">
                    <dt>Money in</dt>
                    <dd className="tnum">{row.moneyIn === null ? "—" : usd(row.moneyIn)}</dd>
                  </div>
                  <div className="stat">
                    <dt>Mints</dt>
                    <dd className="tnum">{row.mints === null ? "—" : row.mints}</dd>
                  </div>
                  <div className="stat">
                    <dt>Creator earned</dt>
                    <dd className="tnum">
                      {row.creatorEarned === null
                        ? "—"
                        : row.creatorEarned === 0
                          ? `${row.feeBps / 100}% fee`
                          : usd(row.creatorEarned)}
                    </dd>
                  </div>
                </dl>

                <div className="board-foot">
                  <a className="mono link" href={`${explorerBase}address/${row.creator}`}>
                    {row.creator.slice(0, 6)}…{row.creator.slice(-4)}
                  </a>
                  <Link className="chip" href={`/launch?from=${row.address}`}>
                    Fork →
                  </Link>
                </div>
              </div>
            </Reveal>
          );
        })}
      </div>
    </>
  );
}
