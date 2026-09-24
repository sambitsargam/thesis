"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import type {LiveBasket} from "./api/basket/route";

/**
 * Polls basket state so the page reflects a mint without a reload.
 *
 * Polling pauses while the tab is hidden — there is no reason to hammer an RPC
 * for a page nobody is looking at — and resumes with an immediate read so the
 * numbers are correct the moment the viewer comes back.
 */
export function useLiveBasket(address: string, initial: LiveBasket, intervalMs = 8000) {
  const [data, setData] = useState<LiveBasket>(initial);
  const [pulse, setPulse] = useState(false);
  const inflight = useRef(false);

  const read = useCallback(async () => {
    if (inflight.current) return;
    inflight.current = true;
    try {
      const response = await fetch("/api/basket", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({address})
      });
      if (!response.ok) return;
      const next = (await response.json()) as LiveBasket;
      setData((current) => {
        if (current.supply !== next.supply) {
          setPulse(true);
          setTimeout(() => setPulse(false), 1400);
        }
        return next;
      });
    } catch {
      // A dropped poll is not worth surfacing; the next tick will catch up.
    } finally {
      inflight.current = false;
    }
  }, [address]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const start = () => {
      void read();
      timer = setInterval(() => void read(), intervalMs);
    };

    const onVisibility = () => {
      clearInterval(timer);
      if (document.visibilityState === "visible") start();
    };

    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [read, intervalMs]);

  return {data, pulse, refresh: read};
}
