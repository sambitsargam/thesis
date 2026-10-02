"use client";

import Link from "next/link";
import {useState} from "react";
import {Reveal} from "./motion";
import {useWallet} from "./WalletProvider";

/** The issuer's name belongs to the site, not to every card on it. */
const title = (name: string) =>
  name.replace(/^Thesis\s+/i, "").replace(/,?\s*equal weight$/i, "");

/** True when the theme line would only repeat the title back. */
const sameAsTitle = (name: string, theme: string) =>
  title(name).trim().toLowerCase() === title(theme).trim().toLowerCase();

interface Basket {
  address: string;
  name: string;
  symbol: string;
  theme: string;
  tickers: string[];
  creator: string;
  supply: string;
  /** Which factory deployed it. V1 baskets charge no creator fee. */
  version: 1 | 2;
  feeBps: number;
}

/**
 * @param limit Most cards to show before pointing at the full listing. The landing page
 *        shows a handful; sixteen cards there buries everything below them.
 */
export default function BasketGallery({baskets, limit}: {baskets: Basket[]; limit?: number}) {
  const {account} = useWallet();
  const [mineOnly, setMineOnly] = useState(false);

  const isMine = (basket: Basket) =>
    Boolean(account) && basket.creator.toLowerCase() === account!.toLowerCase();

  const mineCount = baskets.filter(isMine).length;
  const matching = mineOnly ? baskets.filter(isMine) : baskets;
  // Filtering to your own is a deliberate request, so it is never truncated.
  const shown = limit && !mineOnly ? matching.slice(0, limit) : matching;
  const hidden = matching.length - shown.length;

  if (baskets.length === 0) {
    return (
      <div className="card">
        <div className="card-theme">
          No baskets deployed yet. <Link href="/launch">Launch the first one →</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {account && mineCount > 0 && (
        <div className="pills" style={{marginBottom: 14}}>
          <button className="pill" aria-pressed={!mineOnly} onClick={() => setMineOnly(false)}>
            All {baskets.length}
          </button>
          <button className="pill" aria-pressed={mineOnly} onClick={() => setMineOnly(true)}>
            Created by you {mineCount}
          </button>
        </div>
      )}

      <div className="gallery">
        {shown.map((basket, i) => (
        <Reveal key={basket.address} delay={i * 70}>
          {/*
            A div, not a link: the card holds its own Fork link, and nesting an anchor
            inside an anchor is invalid. The title stretches to cover the card instead,
            so the whole surface still opens the basket.
          */}
          <div className="card basket-card">
            <div className="card-head">
              <div>
                <div className="card-title">
                  <Link className="stretched" href={`/basket/${basket.address}`}>
                    {title(basket.name)}
                  </Link>
                  {isMine(basket) && <span className="mine">Yours</span>}
                </div>
                {!sameAsTitle(basket.name, basket.theme) && (
                  <div className="card-theme">&ldquo;{basket.theme}&rdquo;</div>
                )}
              </div>
              <span className="ticker">{basket.symbol}</span>
            </div>

            <div className="pills">
              {basket.tickers.map((ticker) => (
                <span className="pill" key={ticker}>
                  {ticker}
                </span>
              ))}
              <span className="pill">
                {Number(basket.supply) === 0
                  ? "nobody has bought yet"
                  : `${basket.supply.replace(/\.0+$/, "")} shares`}
              </span>
              {basket.feeBps > 0 && (
                <span className="pill">{basket.feeBps / 100}% to creator</span>
              )}
            </div>

            <div className="card-actions">
              <Link className="chip" href={`/launch?from=${basket.address}`}>
                Fork it →
              </Link>
            </div>
          </div>
          </Reveal>
        ))}
      </div>

      {hidden > 0 && (
        <p className="gallery-more">
          <Link href="/leaderboard">
            {hidden} more {hidden === 1 ? "basket" : "baskets"}, ranked by what they hold →
          </Link>
        </p>
      )}

      {shown.length === 0 && (
        <div className="card">
          <div className="card-theme">
            You haven&rsquo;t created a basket yet. <Link href="/launch">Launch one →</Link>
          </div>
        </div>
      )}
    </>
  );
}
