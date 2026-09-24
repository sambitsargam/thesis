"use client";

import {useState} from "react";
import {encodeFunctionData} from "viem";
import {thesisBasketAbi} from "@thesis/shared";
import {useWallet} from "../../WalletProvider";

interface Leg {
  tokenIn: `0x${string}`;
  tokenOut: `0x${string}`;
  amountIn: string;
  minAmountOut: string;
  swapData: `0x${string}`;
}

interface Props {
  basket: `0x${string}`;
  agent: `0x${string}`;
  tickerFor: Record<string, string>;
  onRebalanced?: () => void;
}

/**
 * Trades the basket back toward equal weight.
 *
 * Only the agent can call `rebalance`, and the contract refuses any leg without a
 * floor price and any sequence that leaves quote token behind — so the worst an
 * agent can do is trade badly, never withdraw.
 */
export default function RebalancePanel(props: Props) {
  const {account, client, discover} = useWallet();
  const [legs, setLegs] = useState<Leg[] | null>(null);
  const [drifts, setDrifts] = useState<Array<{token: string; driftBps: number}>>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const isAgent = Boolean(account) && account!.toLowerCase() === props.agent.toLowerCase();

  async function plan() {
    setBusy(true);
    setError("");
    setTxHash("");
    setReason("");
    try {
      const response = await fetch("/api/rebalance", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({basket: props.basket})
      });
      const body = (await response.json()) as {
        legs?: Leg[];
        drifts?: Array<{token: string; driftBps: number}>;
        reason?: string;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? "Could not plan a rebalance.");
      setLegs(body.legs ?? []);
      setDrifts(body.drifts ?? []);
      setReason(body.reason ?? "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not plan a rebalance.");
    } finally {
      setBusy(false);
    }
  }

  async function execute() {
    if (!legs || legs.length === 0 || !client || !account) return;
    setBusy(true);
    setError("");
    try {
      const data = encodeFunctionData({
        abi: thesisBasketAbi,
        functionName: "rebalance",
        args: [
          legs.map((leg) => ({
            tokenIn: leg.tokenIn,
            tokenOut: leg.tokenOut,
            amountIn: BigInt(leg.amountIn),
            minAmountOut: BigInt(leg.minAmountOut),
            swapData: leg.swapData
          }))
        ]
      });
      const hash = await client.sendTransaction({account, chain: null, to: props.basket, data});
      setTxHash(hash);
      setLegs(null);
      props.onRebalanced?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message.split("\n")[0]! : "Rebalance failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2>Rebalance</h2>
        <span className="note">
          {isAgent ? "You are the agent for this basket" : "Agent only"}
        </span>
      </div>

      <div className="card">
        <p className="panel-lede" style={{margin: 0}}>
          Equal weight is a statement about value, so a basket drifts as its holdings
          move. Rebalancing sells what has grown and buys what has lagged — value never
          leaves the basket.
        </p>

        {drifts.length > 0 && (
          <div className="preview" style={{marginTop: 16}}>
            <div className="preview-title">Drift from target</div>
            {drifts.map((d) => (
              <div className="row" key={d.token}>
                <span>{props.tickerFor[d.token.toLowerCase()] ?? d.token.slice(0, 8)}</span>
                <span className={`tnum alloc-drift ${d.driftBps > 0 ? "over" : "under"}`}>
                  {d.driftBps > 0 ? "+" : ""}
                  {(d.driftBps / 100).toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        )}

        {legs && legs.length > 0 && (
          <div className="preview" style={{marginTop: 12}}>
            <div className="preview-title">Planned trades</div>
            {legs.map((leg, i) => (
              <div className="row" key={`${leg.tokenIn}-${leg.tokenOut}-${i}`}>
                <span>
                  {props.tickerFor[leg.tokenIn.toLowerCase()] ?? "?"} →{" "}
                  {props.tickerFor[leg.tokenOut.toLowerCase()] ?? "?"}
                </span>
                <span className="tnum">{(Number(leg.amountIn) / 1e18).toFixed(9)}</span>
              </div>
            ))}
          </div>
        )}

        {reason && <p className="status">{reason}</p>}

        <div className="controls">
          {!account ? (
            <button className="ghost" onClick={() => void discover()}>
              Connect wallet
            </button>
          ) : (
            <>
              <button className="ghost" onClick={plan} disabled={busy}>
                {busy && !legs ? "Checking drift…" : "Check drift"}
              </button>
              {legs && legs.length > 0 && (
                <button onClick={execute} disabled={busy || !isAgent}>
                  {busy ? "Rebalancing…" : isAgent ? "Rebalance now" : "Agent only"}
                </button>
              )}
            </>
          )}
        </div>

        {txHash && (
          <div className="receipt">
            <div className="headline">Rebalanced</div>
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
    </section>
  );
}
