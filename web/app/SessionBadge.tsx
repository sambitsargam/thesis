"use client";

import {useEffect, useState} from "react";
import {type MarketSession, marketSession} from "@thesis/shared";

/**
 * What the US equity market is doing right now, shown where someone is about to mint.
 *
 * Baskets mint at any hour because xStocks are ERC-20s, but the equities behind them
 * have a session, and pricing outside it is worse. Saying so is more honest than a badge
 * that only ever reads "live", and it is the first thing anyone asks about tokenized
 * equities.
 *
 * The clock is read on the client only: rendering it on the server would bake in the
 * build machine's instant and mismatch on hydration.
 */
export default function SessionBadge() {
  const [session, setSession] = useState<MarketSession | null>(null);

  useEffect(() => {
    const tick = () => setSession(marketSession());
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!session) return null;

  return (
    <div className={`session ${session.isOpen ? "live" : ""}`}>
      <span className="session-dot" aria-hidden="true" />
      <span className="session-label">{session.label}</span>
      <span className="session-detail">{session.detail}</span>
    </div>
  );
}
