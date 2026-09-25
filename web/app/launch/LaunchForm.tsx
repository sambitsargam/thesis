"use client";

import {useRouter} from "next/navigation";
import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {type Briefing, BriefingCard, ResearchProgress} from "./Research";
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
  const [resolving, setResolving] = useState(false);
  const [rationale, setRationale] = useState("");
  const [model, setModel] = useState("");
  const [researching, setResearching] = useState(false);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
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

  /**
   * Asks the model to turn the theme into constituents.
   *
   * Selection happens server-side against the real catalogue, and anything the
   * model invents is dropped there — a hallucinated ticker would deploy a basket
   * that could never be minted.
   */
  async function resolveWithAi() {
    if (!theme.trim()) {
      setError("Describe the theme first.");
      return;
    }
    setResolving(true);
    setError("");
    try {
      const response = await fetch("/api/resolve", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({theme})
      });
      const body = (await response.json()) as {
        name?: string;
        symbol?: string;
        rationale?: string;
        model?: string;
        constituents?: TokenizedEquity[];
        error?: string;
      };
      if (!response.ok || !body.constituents) throw new Error(body.error ?? "Could not resolve.");

      for (const token of body.constituents) known.current.set(token.address, token);
      setPicked(body.constituents.map((t) => t.address));
      setResults(body.constituents);
      setQuery("");
      if (body.symbol) setSymbol(body.symbol);
      setRationale(body.rationale ?? "");
      setModel(body.model ?? "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not resolve the theme.");
    } finally {
      setResolving(false);
    }
  }

  /**
   * Searches the web, then builds the basket from what it found.
   *
   * Selection is still constrained to the real catalogue server-side, so research
   * can inform the picks but cannot conjure a token that does not exist.
   */
  async function runDeepResearch() {
    if (!theme.trim()) {
      setError("Describe the theme first.");
      return;
    }
    setResearching(true);
    setError("");
    setBriefing(null);
    setRationale("");
    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({theme})
      });
      const body = (await response.json()) as Briefing & {error?: string};
      if (!response.ok || !body.picks) throw new Error(body.error ?? "Research failed.");

      for (const pick of body.picks) {
        known.current.set(pick.address, {
          ticker: pick.ticker,
          name: pick.name,
          address: pick.address,
          wrapped: false
        });
      }
      setBriefing(body);
      setPicked(body.picks.map((p) => p.address));
      setResults(body.picks.map((p) => ({
        ticker: p.ticker,
        name: p.name,
        address: p.address,
        wrapped: false
      })));
      setQuery("");
      setSymbol(body.symbol);
      setModel(`${body.models.search} + ${body.models.select}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Research failed.");
    } finally {
      setResearching(false);
    }
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
        const body = (await probe.json()) as {error?: string; unroutable?: string[]};
        const names = (body.unroutable ?? [])
          .map((a) => known.current.get(a)?.ticker ?? a.slice(0, 8))
          .join(", ");

        // Drop the dead ones rather than blocking: the basket is fine without them.
        if (body.unroutable?.length) {
          const keep = picked.filter((a) => !body.unroutable!.includes(a));
          setPicked(keep);
          throw new Error(
            keep.length > 0
              ? `${names} has no liquidity on X Layer yet, so a basket holding it could never be minted. Removed — press Deploy again to launch with the remaining ${keep.length}.`
              : `None of these have liquidity on X Layer yet. Try a different theme.`
          );
        }
        throw new Error(body.error ?? "Could not verify the routes.");
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

        <div className="controls" style={{marginTop: 12}}>
          <button onClick={runDeepResearch} disabled={researching || resolving || !theme.trim()}>
            {researching ? "Researching…" : "Deep research"}
          </button>
          <button
            className="ghost"
            onClick={resolveWithAi}
            disabled={resolving || researching || !theme.trim()}
          >
            {resolving ? "Choosing…" : "Quick pick"}
          </button>
          <span className="avail">or start from a preset</span>
        </div>

        {researching && <ResearchProgress />}
        {briefing && <BriefingCard data={briefing} />}

        {rationale && (
          <div className="rationale">
            <div className="preview-title">Why these {picked.length}</div>
            <p style={{margin: 0}}>{rationale}</p>
            {model && <span className="rationale-model">{model}</span>}
          </div>
        )}

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

          <div className="picker-count">
            <span>
              {searching
                ? "Searching…"
                : total === null
                  ? `${results.length} shown`
                  : query
                    ? `${results.length} match${results.length === 1 ? "" : "es"} for “${query}”`
                    : `All ${results.length} tokenized equities — scroll, or search to narrow`}
            </span>
            {!query && total !== null && results.length < total && (
              <span>Type a ticker or company name</span>
            )}
          </div>

          <div className="picker-wrap">
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
