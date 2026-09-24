"use client";

import {useRouter} from "next/navigation";
import {useMemo, useState} from "react";
import {decodeEventLog} from "viem";
import {thesisFactoryAbi, XSTOCKS} from "@thesis/shared";
import {useWallet} from "../WalletProvider";

const MAX_CONSTITUENTS = 10;

const PRESETS = [
  {theme: "US megacap equities, equal weight", symbol: "MEGA", tickers: ["NVDAx", "TSLAx", "SPYx"]},
  {theme: "AI and electric vehicles, equal weight", symbol: "AIEV", tickers: ["NVDAx", "TSLAx"]},
  {theme: "Broad market plus semiconductors", symbol: "BRDS", tickers: ["SPYx", "NVDAx"]}
];

export default function LaunchForm({factory}: {factory: `0x${string}`}) {
  const {account, client, discover} = useWallet();
  const router = useRouter();

  const [theme, setTheme] = useState("");
  const [symbol, setSymbol] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{hash: string; basket?: string} | null>(null);

  const weight = picked.length > 0 ? 100 / picked.length : 0;
  const name = useMemo(() => (theme.trim() ? `Thesis ${theme.trim()}` : ""), [theme]);

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

  async function launch() {
    if (!account || !client) return;
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      if (!theme.trim()) throw new Error("Describe the theme first.");
      if (!symbol.trim()) throw new Error("Pick a ticker symbol.");
      if (picked.length === 0) throw new Error("Select at least one equity.");

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
          <label>
            Constituents
            {picked.length > 0 && (
              <span className="avail">
                {" "}
                · {picked.length} selected, {weight.toFixed(2)}% each
              </span>
            )}
          </label>
          <div className="picker">
            {XSTOCKS.map((token) => {
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

        {!account ? (
          <button onClick={() => void discover()} style={{marginTop: 22, width: "100%"}}>
            Connect wallet to launch
          </button>
        ) : (
          <button onClick={launch} disabled={busy} style={{marginTop: 22, width: "100%"}}>
            {busy ? "Deploying…" : "Deploy basket"}
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
