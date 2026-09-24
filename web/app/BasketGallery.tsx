"use client";

import Link from "next/link";
import {useState} from "react";
import {Reveal} from "./motion";
import {useWallet} from "./WalletProvider";

interface Basket {
  address: string;
  name: string;
  symbol: string;
  theme: string;
  tickers: string[];
  creator: string;
  supply: string;
}

export default function BasketGallery({baskets}: {baskets: Basket[]}) {
  const {account} = useWallet();
  const [mineOnly, setMineOnly] = useState(false);

  const isMine = (basket: Basket) =>
    Boolean(account) && basket.creator.toLowerCase() === account!.toLowerCase();

  const mineCount = baskets.filter(isMine).length;
  const shown = mineOnly ? baskets.filter(isMine) : baskets;

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

      {shown.map((basket, i) => (
        <Reveal key={basket.address} delay={i * 70}>
          <Link className="card" href={`/basket/${basket.address}`}>
            <div className="card-head">
              <div>
                <div className="card-title">
                  {basket.name}
                  {isMine(basket) && <span className="mine">Yours</span>}
                </div>
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
              <span className="pill">{basket.supply.replace(/\.0+$/, "")} shares</span>
            </div>
          </Link>
        </Reveal>
      ))}

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
