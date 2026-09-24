"use client";

import {useRouter} from "next/navigation";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {decodeEventLog} from "viem";
import {thesisFactoryAbi, type TokenizedEquity, XSTOCKS} from "@thesis/shared";
import {useWallet} from "../WalletProvider";

const MAX_CONSTITUENTS = 10;

const PRESETS = [
  {
    theme: "semiconductor supply chain, equal weight",
    symbol: "SEMI",
    tickers: ["NVDAx", "AMDx", "TSMx", "ASMLx"]
  },
  {theme: "US megacap technology, equal weight", symbol: "MEGA", tickers: ["AAPLx", "AMZNx", "NVDAx"]},
  {theme: "AI and electric vehicles, equal weight", symbol: "AIEV", tickers: ["NVDAx", "TSLAx"]}
];

export default function LaunchForm({factory}: {factory: `0x${string}`}) {
  const {account, client, discover} = useWallet();
  const router = useRouter();

  const [theme, setTheme] = useState("");
  const [symbol, setSymbol] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TokenizedEquity[]>(XSTOCKS);
  const [total, setTotal] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const known = useRef(new Map<string, TokenizedEquity>(XSTOCKS.map((t) => [t.address, t])));
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{hash: string; basket?: string} | null>(null);

  const weight = picked.length > 0 ? 100 / picked.length : 0;
  const name = useMemo(() => (theme.trim() ? `Thesis ${theme.trim()}` : ""), [theme]);

  // Debounced so typing a ticker does not fire a request per keystroke.
  const search = useCallback(async (term: string) => {
    setSearching(true);
    try {
      const response = await fetch(`/api/tokens?q=${encodeURIComponent(term)}`);
      if (!response.ok) return;
      const body = (await response.json()) as {tokens: TokenizedEquity[]; total: number};
      for (const token of body.tokens) known.current.set(token.address, token);
      setResults(body.tokens);
      setTotal(body.total);
    } catch {
      // Keep whatever is on screen; the catalogue is a convenience, not a gate.
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void search(query), query ? 220 : 0);
    return () => clearTimeout(timer);
  }, [query, search]);

  function toggle(address: string) {
    setError("");
    setPicked((current) =>
      current.includes(address)
        ? current.filter((a) => a !== address)
        : current.length >= MAX_CONSTITUENTS
          ? current
          : [...current, address]
    );
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setTheme(preset.theme);
    setSymbol(preset.symbol);
    setPicked(
      preset.tickers
        .map((ticker) => XSTOCKS.find((t) => t.ticker === ticker)?.address)
        .filter((a): a is `0x${string}` => Boolean(a))
    );
  }

  /** Selected tokens stay visible even when a search no longer returns them. */
  const selected = picked
    .map((address) => known.current.get(address))
    .filter((t): t is TokenizedEquity => Boolean(t));

  async function launch() {
    if (!account || !client) return;
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      if (!theme.trim()) throw new Error("Describe the theme first.");
      if (!symbol.trim()) throw new Error("Pick a ticker symbol.");
      if (picked.length === 0) throw new Error("Select at least one equity.");

      // Constituents are fixed at deployment, so an unroutable one makes the basket
      // permanently unmintable. Prove every leg quotes before spending gas.
      setChecking(true);
      const probe = await fetch("/api/quote", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({
          legs: picked.map((token) => ({token, amount: "1000000"}))
        })
      });
      setChecking(false);
      if (!probe.ok) {
        const body = (await probe.json()) as {error?: string};
        throw new Error(
          `One of these equities cannot be routed from USD₮0 yet, so the basket could never be minted. ${body.error ?? ""}`.trim()
        );
      }

      const hash = await client.writeContract({
        account,
        chain: null,
        address: factory,
        abi: thesisFactoryAbi,
        functionName: "createBasket",
        args: [
          name.slice(0, 64),
          `THESIS-${symbol.trim().toUpperCase()}`.slice(0, 20),
          theme.trim(),
          picked as `0x${string}`[]
        ]
      });

      setCreated({hash});

      // Pull the basket address out of BasketCreated so we can link straight to it.
      const receipt = await fetch("/api/receipt", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({hash})
      })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);

      if (receipt?.basket) {
        setCreated({hash, basket: receipt.basket});
        router.refresh();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message.split("\n")[0]! : "Could not create the basket.");
    } finally {
      setBusy(false);
      setChecking(false);
    }
  }

  return (
    <div className="panel">
      <div className="panel-body">
        <div className="field">
          <label htmlFor="theme">Your theme</label>
          <input
            id="theme"
            value={theme}
            placeholder="semiconductor supply chain, equal weight"
            onChange={(e) => setTheme(e.target.value)}
          />
        </div>

        <div className="pills" style={{marginTop: 12}}>
          {PRESETS.map((preset) => (
            <button key={preset.symbol} className="pill" onClick={() => applyPreset(preset)}>
              {preset.theme}
            </button>
          ))}
        </div>

        <div className="field" style={{marginTop: 22}}>
          <label htmlFor="symbol">
            Ticker <span className="avail">· shown as THESIS-{symbol.toUpperCase() || "…"}</span>
          </label>
          <input
            id="symbol"
            value={symbol}
            placeholder="SEMI"
            maxLength={10}
            onChange={(e) => setSymbol(e.target.value.replace(/[^a-zA-Z0-9-]/g, ""))}
          />
        </div>

        <div className="field" style={{marginTop: 22}}>
          <label htmlFor="search">
            Constituents
            {picked.length > 0 && (
              <span className="avail">
                {" "}
                · {picked.length} selected, {weight.toFixed(2)}% each
              </span>
            )}
          </label>

          <input
            id="search"
            value={query}
            placeholder={
              total ? `Search ${total} tokenized equities — try NVDA, ASML, Apple` : "Search equities…"
            }
            onChange={(e) => setQuery(e.target.value)}
          />

          {selected.length > 0 && (
            <div className="chosen">
              {selected.map((token) => (
                <button key={token.address} className="chosen-chip" onClick={() => toggle(token.address)}>
                  {token.ticker}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          )}

          <div className="picker">
            {results.map((token) => {
              const on = picked.includes(token.address);
              return (
                <button
                  key={token.address}
                  className="pick"
                  aria-pressed={on}
                  onClick={() => toggle(token.address)}
                >
                  <span className="pick-ticker">{token.ticker}</span>
                  <span className="pick-name">{token.name}</span>
                  <span className="pick-mark">{on ? "✓" : "+"}</span>
                </button>
              );
            })}
          </div>

          {results.length === 0 && !searching && (
            <p className="status">No equity matches &ldquo;{query}&rdquo;.</p>
          )}
        </div>

        {!account ? (
          <button onClick={() => void discover()} style={{marginTop: 22, width: "100%"}}>
            Connect wallet to launch
          </button>
        ) : (
          <button onClick={launch} disabled={busy} style={{marginTop: 22, width: "100%"}}>
            {checking ? "Checking routes…" : busy ? "Deploying…" : "Deploy basket"}
          </button>
        )}

        {created && (
          <div className="receipt">
            <div className="headline">Basket deployed</div>
            <p className="status" style={{marginTop: 6}}>
              It is live on X Layer and anyone can mint it. You are recorded as the creator.
            </p>
            <a
              className="mono link"
              href={`https://www.oklink.com/xlayer/tx/${created.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              {created.hash}
            </a>
            {created.basket && (
              <p style={{marginTop: 12}}>
                <a className="mono link" href={`/basket/${created.basket}`}>
                  Open your basket →
                </a>
              </p>
            )}
          </div>
        )}
        {error && <p className="status error">{error}</p>}
      </div>
    </div>
  );
}
