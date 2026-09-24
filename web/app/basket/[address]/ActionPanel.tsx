"use client";

import {useCallback, useEffect, useState} from "react";
import {encodeFunctionData, parseUnits} from "viem";
import {erc20Abi, thesisBasketAbi, thesisZapAbi} from "@thesis/shared";
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
type Payout = "quote" | "kind";
type Phase = "idle" | "quoting" | "approving" | "sending" | "done";

const MINT_STEPS = [
  {key: "quoting" as const, label: "Pricing each leg through Onchain OS Trade"},
  {key: "approving" as const, label: "Approving USD₮0"},
  {key: "sending" as const, label: "Buying constituents and minting shares"}
];

const REDEEM_STEPS = [
  {key: "sending" as const, label: "Burning shares and returning the underlying"}
];

const SELL_STEPS = [
  {key: "quoting" as const, label: "Pricing each constituent back to USD₮0"},
  {key: "approving" as const, label: "Approving your shares"},
  {key: "sending" as const, label: "Burning shares and selling the underlying"}
];

const ZAP = process.env.NEXT_PUBLIC_ZAP_ADDRESS as `0x${string}` | undefined;

export default function ActionPanel(props: Props) {
  const {account, client, wallet, discover} = useWallet();
  const [mode, setMode] = useState<Mode>("mint");
  const [payout, setPayout] = useState<Payout>("quote");
  const [amount, setAmount] = useState("3");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");
  const [balances, setBalances] = useState<{quote: string; shares: string} | null>(null);
  const [received, setReceived] = useState<Array<{ticker: string; address: string; amount: number}>>([]);
  const [watched, setWatched] = useState<string[]>([]);

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

  // A receipt belongs to the account that produced it: clear it on any change.
  useEffect(() => {
    setPhase("idle");
    setTxHash("");
    setError("");
    if (!account) setBalances(null);
  }, [account]);

  const sellsForCash = mode === "redeem" && payout === "quote" && Boolean(ZAP);
  const busy = phase === "quoting" || phase === "approving" || phase === "sending";
  const steps = mode === "mint" ? MINT_STEPS : sellsForCash ? SELL_STEPS : REDEEM_STEPS;
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
    setReceived([]);
  }

  /**
   * Asks the wallet to display a token (EIP-747).
   *
   * Redeeming returns tokenized equities, which no wallet lists by default, so
   * without this the underlying arrives invisibly and reads as a failed sale.
   */
  async function addToWallet(token: {ticker: string; address: string}) {
    if (!wallet) return;
    try {
      await wallet.provider.request({
        method: "wallet_watchAsset",
        params: {
          type: "ERC20",
          options: {address: token.address, symbol: token.ticker, decimals: 18}
        } as unknown as unknown[]
      });
      setWatched((current) => [...current, token.address]);
    } catch {
      // Declining the prompt is a normal outcome, not an error worth showing.
    }
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
      else if (sellsForCash) await runSellForQuote();
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

    // Record the claim now so the receipt can name what the wallet just received.
    setReceived(
      props.holdings.map((holding) => ({
        ticker: holding.ticker,
        address: holding.address,
        amount: Number(holding.perShare) * Number(amount)
      }))
    );

    // Redemption is in kind and needs no venue: the claim is a share of what is held.
    const data = encodeFunctionData({
      abi: thesisBasketAbi,
      functionName: "redeem",
      args: [shares]
    });

    setPhase("sending");
    setTxHash(await client!.sendTransaction({account: account!, chain: null, to: props.basket, data}));
  }

  /** Burn shares and take USD₮0 out, selling every constituent in one transaction. */
  async function runSellForQuote() {
    if (!ZAP) throw new Error("Sell-for-cash is not configured on this deployment.");
    const shares = parseUnits(amount, 18);
    if (shares <= 0n) throw new Error("Enter an amount above zero.");

    // Quote each constituent for the amount this redemption will release.
    const legs = props.holdings.map((holding) => ({
      token: holding.address,
      amount: parseUnits(
        (Number(holding.perShare) * Number(amount)).toFixed(18),
        18
      ).toString()
    }));

    setPhase("quoting");
    const response = await fetch("/api/quote", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({legs, direction: "sell"})
    });
    const body = (await response.json()) as {quotes?: Array<{data: `0x${string}`}>; error?: string};
    if (!response.ok || !body.quotes) throw new Error(body.error ?? "Could not price the sale.");

    setPhase("approving");
    await client!.writeContract({
      account: account!,
      chain: null,
      address: props.basket,
      abi: erc20Abi,
      functionName: "approve",
      args: [ZAP, shares]
    });

    setPhase("sending");
    const data = encodeFunctionData({
      abi: thesisZapAbi,
      functionName: "sellForQuote",
      args: [props.basket, shares, body.quotes.map((q) => q.data), 0n]
    });
    setTxHash(await client!.sendTransaction({account: account!, chain: null, to: ZAP, data}));
  }

  const preview =
    mode === "redeem" && payout === "kind" && amount
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
            : sellsForCash
              ? "Burn shares, sell every constituent at market, and take USD₮0 out — in one transaction."
              : "Burn shares and take the underlying equities out, pro rata. No price needed, no slippage."}
        </p>

        {mode === "redeem" && ZAP && (
          <div className="pills" style={{marginTop: 14}}>
            <button
              className="pill"
              aria-pressed={payout === "quote"}
              onClick={() => {
                setPayout("quote");
                reset();
              }}
            >
              Receive USD₮0
            </button>
            <button
              className="pill"
              aria-pressed={payout === "kind"}
              onClick={() => {
                setPayout("kind");
                reset();
              }}
            >
              Receive the equities
            </button>
          </div>
        )}

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
                    : sellsForCash
                      ? `Sell for USD₮0`
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
                ? "Your shares are backed by the equities the basket just bought. Add the token to see them in your wallet."
                : sellsForCash
                  ? "USD₮0 is back in your wallet."
                  : "The underlying equities are in your wallet now. Most wallets hide unknown tokens — add them to see the balances."}
            </p>

            {mode === "mint" && (
              <div className="received">
                <div className="received-row">
                  <span className="received-name">{props.symbol}</span>
                  <span className="tnum received-amt">your new shares</span>
                  <button
                    className="ghost small"
                    onClick={() =>
                      void addToWallet({ticker: props.symbol, address: props.basket})
                    }
                    disabled={watched.includes(props.basket)}
                  >
                    {watched.includes(props.basket) ? "Added" : "Add to wallet"}
                  </button>
                </div>
              </div>
            )}

            {mode === "redeem" && payout === "kind" && received.length > 0 && (
              <div className="received">
                {received.map((token) => (
                  <div className="received-row" key={token.address}>
                    <span className="received-name">{token.ticker}</span>
                    <span className="tnum received-amt">{token.amount.toFixed(9)}</span>
                    <button
                      className="ghost small"
                      onClick={() => void addToWallet(token)}
                      disabled={watched.includes(token.address)}
                    >
                      {watched.includes(token.address) ? "Added" : "Add to wallet"}
                    </button>
                  </div>
                ))}
              </div>
            )}
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
