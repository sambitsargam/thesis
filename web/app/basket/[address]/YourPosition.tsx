"use client";

import {useCallback, useEffect, useState} from "react";
import {Flash, Reveal} from "../../motion";
import {usd, usePrices} from "../../usePrices";
import {useWallet} from "../../WalletProvider";

interface Holding {
  ticker: string;
  address: string;
  perShare: string;
}

/**
 * The connected wallet's stake in this basket.
 *
 * Renders nothing at all when no wallet is connected — a dashboard must never
 * leave someone else's position on screen after a disconnect. State is cleared
 * on account change rather than merely hidden.
 */
export default function YourPosition({
  basket,
  symbol,
  supply,
  holdings,
  refreshKey
}: {
  basket: string;
  symbol: string;
  supply: string;
  holdings: Holding[];
  refreshKey: string;
}) {
  const {account} = useWallet();
  const {prices, ready: pricesReady} = usePrices();
  const [shares, setShares] = useState<string | null>(null);

  const read = useCallback(async () => {
    if (!account) {
      setShares(null);
      return;
    }
    try {
      const response = await fetch("/api/balances", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({account, basket})
      });
      if (!response.ok) return;
      const body = (await response.json()) as {shares: string};
      setShares(body.shares);
    } catch {
      // Leave the last known value; the next poll will correct it.
    }
  }, [account, basket]);

  useEffect(() => {
    void read();
    const timer = setInterval(() => void read(), 12_000);
    return () => clearInterval(timer);
  }, [read, refreshKey]);

  // Disconnected: show nothing. Not a stale balance, not an empty shell.
  if (!account) return null;

  const owned = Number(shares ?? "0");
  const total = Number(supply);
  const share = total > 0 ? (owned / total) * 100 : 0;

  const claims = holdings.map((holding) => {
    const amount = Number(holding.perShare) * owned;
    const price = prices[holding.address.toLowerCase()] ?? 0;
    return {ticker: holding.ticker, amount, value: amount * price};
  });
  const positionValue = claims.reduce((sum, claim) => sum + claim.value, 0);
  const showUsd = pricesReady && positionValue > 0;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Your position</h2>
        <span className="note">
          {account.slice(0, 6)}…{account.slice(-4)}
        </span>
      </div>

      <Reveal>
        <div className="card position">
          {shares === null ? (
            <div className="row">
              <span>Loading</span>
              <span className="skeleton">0.000000</span>
            </div>
          ) : owned === 0 ? (
            <p className="panel-lede" style={{margin: 0}}>
              You don&rsquo;t hold {symbol} yet. Buy some above and your claim on the
              underlying equities appears here.
            </p>
          ) : (
            <>
              <div className="position-head">
                <div>
                  <div className="position-value tnum">
                    <Flash watch={shares}>{owned.toFixed(6)}</Flash>
                  </div>
                  <div className="position-label">{symbol} held</div>
                </div>
                <div>
                  <div className="position-value tnum">{share.toFixed(2)}%</div>
                  <div className="position-label">of all shares</div>
                </div>
                <div style={{textAlign: "right"}}>
                  <div className="position-value tnum accent">
                    {showUsd ? usd(positionValue) : "—"}
                  </div>
                  <div className="position-label">market value</div>
                </div>
              </div>

              <div className="position-claim">
                <div className="preview-title">Your claim on the underlying</div>
                {claims.map((claim) => (
                  <div className="row" key={claim.ticker}>
                    <span>{claim.ticker}</span>
                    <span className="tnum">
                      {claim.amount.toFixed(9)}
                      {claim.value > 0 && (
                        <span className="claim-usd">{usd(claim.value)}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Reveal>
    </section>
  );
}
