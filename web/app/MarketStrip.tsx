"use client";

import {usd, usePrices} from "./usePrices";
import {Reveal} from "./motion";

export interface StripToken {
  ticker: string;
  name: string;
  address: string;
}

/**
 * A live price row for a handful of equities.
 *
 * Prices come from executable OKX routes rather than a reference feed, so this is
 * also the fastest proof on the page that the Trade integration is real.
 */
export default function MarketStrip({tokens}: {tokens: StripToken[]}) {
  const {prices, ready} = usePrices(tokens.map((t) => t.address));

  return (
    <Reveal>
      <div className="strip">
        {tokens.map((token) => {
          const price = prices[token.address.toLowerCase()];
          return (
            <div className="strip-item" key={token.address}>
              <span className="strip-ticker">{token.ticker}</span>
              <span className="strip-name">{token.name}</span>
              <span className="strip-price tnum">
                {ready && price ? usd(price) : <span className="skeleton">$000.00</span>}
              </span>
            </div>
          );
        })}
        <div className="strip-note">
          Live from Onchain OS Trade · executable prices, not a reference feed
        </div>
      </div>
    </Reveal>
  );
}
