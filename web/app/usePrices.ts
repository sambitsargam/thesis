"use client";

import {useEffect, useState} from "react";

export type Prices = Record<string, number>;

/**
 * Indicative USD prices, refreshed slowly.
 *
 * The server caches for a minute and the aggregator rate limits, so polling
 * hard buys nothing. Returns an empty map until loaded, and callers hide USD
 * figures rather than showing a zero that looks like a real number.
 */
export function usePrices(
  tokens?: string[],
  intervalMs = 60_000
): {prices: Prices; ready: boolean} {
  const [prices, setPrices] = useState<Prices>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const read = async () => {
      try {
        const query = tokens && tokens.length > 0 ? `?tokens=${tokens.join(",")}` : "";
        const response = await fetch(`/api/prices${query}`);
        if (!response.ok) return;
        const body = (await response.json()) as {prices?: Prices};
        if (!cancelled && body.prices) {
          setPrices(body.prices);
          setReady(true);
        }
      } catch {
        // Prices are decoration; the page works without them.
      }
    };

    void read();
    const timer = setInterval(read, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
    // Joined so a new array identity with the same tokens does not re-subscribe.
  }, [tokens?.join(","), intervalMs]);

  return {prices, ready};
}

export function usd(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString(undefined, {maximumFractionDigits: 0})}`;
  if (value >= 1) return `$${value.toFixed(2)}`;
  if (value >= 0.01) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(6)}`;
}
