"use client";

import {useCallback, useEffect, useState} from "react";
import {encodeFunctionData, parseUnits} from "viem";
import {erc20Abi, thesisBasketAbi} from "@thesis/shared";
import {useWallet} from "../../WalletProvider";

const QUOTE_DECIMALS = 6;

interface Holding {
  ticker: string;
  address: string;
  perShare: string;
}

interface Props {
  basket: `0x${string}`;
  symbol: string;
  quoteToken: `0x${string}`;
  constituents: readonly `0x${string}`[];
  holdings: Holding[];
  supplyIsZero: boolean;
  onChanged?: () => void;
}

type Mode = "mint" | "redeem";
type Phase = "idle" | "quoting" | "approving" | "sending" | "done";

const MINT_STEPS = [
  {key: "quoting" as const, label: "Pricing each leg through Onchain OS Trade"},
  {key: "approving" as const, label: "Approving USD₮0"},
  {key: "sending" as const, label: "Buying constituents and minting shares"}
];

const REDEEM_STEPS = [
  {key: "sending" as const, label: "Burning shares and returning the underlying"}
];

export default function ActionPanel(props: Props) {
  const {account, client, discover} = useWallet();
  const [mode, setMode] = useState<Mode>("mint");
  const [amount, setAmount] = useState("3");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [balances, setBalances] = useState<{quote: string; shares: string} | null>(null);

  const readBalances = useCallback(async () => {
    if (!account) return setBalances(null);
    try {
      const response = await fetch("/api/balances", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({account, basket: props.basket})
      });
      if (!response.ok) return;
      setBalances((await response.json()) as {quote: string; shares: string});
    } catch {
      // Non-fatal: the panel still works without a balance hint.
    }
  }, [account, props.basket]);

  useEffect(() => {
    void readBalances();
    const timer = setInterval(() => void readBalances(), 12_000);
    return () => clearInterval(timer);
  }, [readBalances]);

  const busy = phase === "quoting" || phase === "approving" || phase === "sending";
  const steps = mode === "mint" ? MINT_STEPS : REDEEM_STEPS;
  const order: Phase[] = ["idle", "quoting", "approving", "sending", "done"];

  const stateOf = (key: Phase) => {
    if (phase === "done") return "done";
    const now = order.indexOf(phase);
    const mine = order.indexOf(key);
    return now === mine ? "active" : now > mine ? "done" : "todo";
  };

  function reset() {
    setPhase("idle");
    setTxHash("");
    setError("");
  }

  function setMax() {
    if (!balances) return;
    setAmount(mode === "mint" ? balances.quote : balances.shares);
  }

  async function run() {
    if (!account || !client) return;
    reset();
    try {
      if (mode === "mint") await runMint();
      else await runRedeem();
      setPhase("done");
      props.onChanged?.();
      setTimeout(() => void readBalances(), 2500);
      setTimeout(() => props.onChanged?.(), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message.split("\n")[0]! : "Transaction failed.");
      setPhase("idle");
    }
  }

  async function runMint() {
    const quoteAmount = parseUnits(amount, QUOTE_DECIMALS);
    if (quoteAmount <= 0n) throw new Error("Enter an amount above zero.");

    // Split exactly as ThesisBasket does: equal parts, division dust to the last leg.
    const n = BigInt(props.constituents.length);
    const perLeg = quoteAmount / n;
    const legs = props.constituents.map((token, i) => ({
      token,
      amount: (i === props.constituents.length - 1 ? quoteAmount - perLeg * (n - 1n) : perLeg).toString()
    }));

    setPhase("quoting");
    const response = await fetch("/api/quote", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({legs})
    });
    const body = (await response.json()) as {quotes?: Array<{data: `0x${string}`}>; error?: string};
    if (!response.ok || !body.quotes) throw new Error(body.error ?? "Could not fetch routes.");

    setPhase("approving");
    await client!.writeContract({
      account: account!,
      chain: null,
      address: props.quoteToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [props.basket, quoteAmount]
    });

    const minSharesOut = props.supplyIsZero ? quoteAmount * 10n ** 12n : 0n;
    const data = encodeFunctionData({
      abi: thesisBasketAbi,
      functionName: "mint",
      args: [quoteAmount, minSharesOut, body.quotes.map((q) => q.data)]
    });

    setPhase("sending");
    setTxHash(await client!.sendTransaction({account: account!, chain: null, to: props.basket, data}));
  }

  async function runRedeem() {
    const shares = parseUnits(amount, 18);
    if (shares <= 0n) throw new Error("Enter an amount above zero.");

    // Redemption is in kind and needs no venue: the claim is a share of what is held.
    const data = encodeFunctionData({
      abi: thesisBasketAbi,
      functionName: "redeem",
      args: [shares]
    });

    setPhase("sending");
    setTxHash(await client!.sendTransaction({account: account!, chain: null, to: props.basket, data}));
  }

  const preview =
    mode === "redeem" && amount
      ? props.holdings.map((holding) => ({
          ticker: holding.ticker,
          amount: Number(holding.perShare) * (Number(amount) || 0)
        }))
      : null;

  const available = balances
    ? mode === "mint"
      ? `${Number(balances.quote).toFixed(6)} USD₮0`
      : `${Number(balances.shares).toFixed(6)} ${props.symbol}`
    : null;

  return (
    <div className="panel">
      <div className="tabs" role="tablist">
        <button
          role="tab"
          aria-selected={mode === "mint"}
          onClick={() => {
            setMode("mint");
            reset();
            setAmount("3");
          }}
        >
          Buy
        </button>
        <button
          role="tab"
          aria-selected={mode === "redeem"}
          onClick={() => {
            setMode("redeem");
            reset();
            setAmount("1");
          }}
        >
          Sell back
        </button>
      </div>

      <div className="panel-body">
        <p className="panel-lede">
          {mode === "mint"
            ? "One transaction buys every constituent at market and holds it."
            : "Burn shares and take the underlying equities out, pro rata. No price needed, no slippage."}
        </p>

        {!account ? (
          <button onClick={() => void discover()} style={{marginTop: 18}}>
            Connect wallet to {mode === "mint" ? "buy" : "sell"}
          </button>
        ) : (
          <>
            <div className="field" style={{marginTop: 18}}>
              <label htmlFor="amount">
                {mode === "mint" ? "You pay" : "You burn"}
                {available && <span className="avail"> · {available} available</span>}
              </label>
              <div className="input-row">
                <input
                  id="amount"
                  value={amount}
                  inputMode="decimal"
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="unit">{mode === "mint" ? "USD₮0" : props.symbol}</span>
                <button className="ghost small" onClick={setMax} disabled={!balances}>
                  Max
                </button>
              </div>
            </div>

            {preview && (
              <div className="preview">
                <div className="preview-title">You receive</div>
                {preview.map((row) => (
                  <div className="row" key={row.ticker}>
                    <span>{row.ticker}</span>
                    <span className="tnum">{row.amount.toFixed(9)}</span>
                  </div>
                ))}
              </div>
            )}

            <button onClick={run} disabled={busy} style={{marginTop: 18, width: "100%"}}>
              {busy
                ? "Working…"
                : phase === "done"
                  ? mode === "mint"
                    ? "Buy more"
                    : "Sell more"
                  : mode === "mint"
                    ? `Buy ${props.symbol}`
                    : `Redeem ${props.symbol}`}
            </button>
          </>
        )}

        {(busy || phase === "done") && (
          <div className="steps">
            {steps.map((step) => (
              <div className="step" key={step.key} data-state={stateOf(step.key)}>
                <span className="dot">{stateOf(step.key) === "done" ? "✓" : ""}</span>
                {step.label}
              </div>
            ))}
          </div>
        )}

        {txHash && (
          <div className="receipt">
            <div className="headline">
              {mode === "mint" ? `Bought ${props.symbol}` : `Redeemed ${props.symbol}`}
            </div>
            <p className="status" style={{marginTop: 6}}>
              {mode === "mint"
                ? "Your shares are backed by the equities the basket just bought."
                : "The underlying equities are back in your wallet."}
            </p>
            <a
              className="mono link"
              href={`https://www.oklink.com/xlayer/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              {txHash}
            </a>
          </div>
        )}
        {error && <p className="status error">{error}</p>}
      </div>
    </div>
  );
}
