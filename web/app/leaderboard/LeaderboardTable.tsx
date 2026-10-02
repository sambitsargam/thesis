"use client";

import Link from "next/link";
import {useMemo, useState} from "react";
import {usePrices} from "../usePrices";
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
  /** Live balances, priced in the browser rather than on the server. */
  holdings: {token: string; amount: number}[];
}

type SortKey = "tvlUsd" | "moneyIn" | "mints" | "creatorEarned";
type CounterKey = Exclude<SortKey, "tvlUsd">;

const COLUMNS: {key: SortKey; label: string}[] = [
  {key: "tvlUsd", label: "Value held"},
  {key: "moneyIn", label: "Money in"},
  {key: "mints", label: "Mints"},
  {key: "creatorEarned", label: "Creator earns"}
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

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;

/*
 * The issuer's name is the site, not the row.
 *
 * On-chain every basket is called "Thesis <theme>", so printing it whole repeats the
 * wordmark sixteen times and pushes the part that differs off to the right.
 */
const title = (name: string) =>
  name
    .replace(/^Thesis\s+/i, "")
    // Every basket on Thesis is equal weight, so printing it per row says nothing. The
    // table states it once, above.
    .replace(/,?\s*equal weight$/i, "");

/** True when the theme line would only repeat the name back, trimming both the same way. */
const sameAsName = (name: string, theme: string) =>
  title(name).trim().toLowerCase() === title(theme).trim().toLowerCase();

export default function LeaderboardTable({rows, explorerBase}: {rows: Row[]; explorerBase: string}) {
  const {account} = useWallet();
  const [sort, setSort] = useState<SortKey>("tvlUsd");

  const tokens = useMemo(
    () => [...new Set(rows.flatMap((row) => row.holdings.map((h) => h.token.toLowerCase())))],
    [rows]
  );
  const {prices, ready} = usePrices(tokens);

  /*
   * Valued here, in the browser, from the balances the server read.
   *
   * A basket with any unpriced holding values as null rather than as a partial sum: a
   * short total would rank it below baskets worth less than it.
   */
  const valued = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const row of rows) {
      let total: number | null = 0;
      for (const holding of row.holdings) {
        const price = prices[holding.token.toLowerCase()];
        if (price === undefined) {
          total = null;
          break;
        }
        total += holding.amount * price;
      }
      map.set(row.address, total);
    }
    return map;
  }, [rows, prices]);

  const valueOf = (row: Row) => (ready ? (valued.get(row.address) ?? null) : null);

  // Unranked baskets sort last whichever column is chosen, rather than tying at zero.
  const ranked = [...rows].sort((a, b) => {
    const left = sort === "tvlUsd" ? valueOf(a) : a[sort as CounterKey];
    const right = sort === "tvlUsd" ? valueOf(b) : b[sort as CounterKey];
    if (left === null && right === null) return 0;
    if (left === null) return 1;
    if (right === null) return -1;
    return right - left;
  });

  return (
    <div className="board-wrap">
      <table className="board">
        <thead>
          <tr>
            <th scope="col" className="col-rank">
              #
            </th>
            <th scope="col">Basket</th>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="col-num"
                aria-sort={sort === column.key ? "descending" : "none"}
              >
                {/* The header is the control: sorting a table belongs in its own headings. */}
                <button className="col-sort" onClick={() => setSort(column.key)}>
                  {column.label}
                </button>
              </th>
            ))}
            <th scope="col" className="col-act">
              <span className="visually-hidden">Actions</span>
            </th>
          </tr>
        </thead>

        <tbody>
          {ranked.map((row, i) => {
            const mine = Boolean(account) && row.creator.toLowerCase() === account!.toLowerCase();
            const value = valueOf(row);

            return (
              <tr key={row.address}>
                <td className="col-rank">{i + 1}</td>

                <td>
                  <Link className="board-name" href={`/basket/${row.address}`}>
                    {title(row.name)}
                    {mine && <span className="mine">yours</span>}
                  </Link>
                  {!sameAsName(row.name, row.theme) && (
                    <div className="board-theme">&ldquo;{row.theme}&rdquo;</div>
                  )}
                  <div className="board-meta">
                    {row.tickers.join(" · ") || "—"}
                    <span className="board-sep">
                      {row.feeBps > 0 ? `${(row.feeBps / 100).toFixed(2)}% fee` : "no fee"}
                    </span>
                    <span className="board-sep">
                      by{" "}
                      <a className="mono link" href={`${explorerBase}address/${row.creator}`}>
                        {short(row.creator)}
                      </a>
                    </span>
                    {row.version === 1 && <span className="board-sep">v1 basket</span>}
                  </div>
                </td>

                <td className={`col-num${sort === "tvlUsd" ? " col-sorted" : ""}`}>
                  {value === null ? "—" : usd(value)}
                </td>
                <td className={`col-num${sort === "moneyIn" ? " col-sorted" : ""}`}>
                  {row.moneyIn === null ? "—" : usd(row.moneyIn)}
                </td>
                <td className={`col-num${sort === "mints" ? " col-sorted" : ""}`}>
                  {row.mints === null ? "—" : row.mints}
                </td>
                <td className={`col-num${sort === "creatorEarned" ? " col-sorted" : ""}`}>
                  {row.creatorEarned === null ? "—" : usd(row.creatorEarned)}
                </td>

                <td className="col-act">
                  <Link className="chip" href={`/launch?from=${row.address}`}>
                    Fork
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
