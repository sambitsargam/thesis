"use client";

import {useState} from "react";
import {createWalletClient, custom, encodeFunctionData, formatUnits, parseUnits} from "viem";
import {appendBuilderCode, erc20Abi, thesisBasketAbi, xLayer} from "@thesis/shared";

const QUOTE_DECIMALS = 6;

interface Props {
  basket: `0x${string}`;
  symbol: string;
  quoteToken: `0x${string}`;
  constituents: readonly `0x${string}`[];
  supplyIsZero: boolean;
  builderCode?: string;
}

declare global {
  interface Window {
    ethereum?: {request(args: {method: string; params?: unknown[]}): Promise<unknown>};
  }
}

export default function MintPanel(props: Props) {
  const [amount, setAmount] = useState("3");
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function mint() {
    setBusy(true);
    setError("");
    try {
      if (!window.ethereum) throw new Error("No wallet found. Install OKX Wallet or MetaMask.");

      const quoteAmount = parseUnits(amount, QUOTE_DECIMALS);
      if (quoteAmount <= 0n) throw new Error("Enter an amount above zero.");

      const wallet = createWalletClient({chain: xLayer, transport: custom(window.ethereum)});
      const [account] = await wallet.requestAddresses();
      if (!account) throw new Error("No account authorised.");
      await wallet.switchChain({id: xLayer.id}).catch(() => undefined);

      // Split exactly as ThesisBasket does: equal parts, division dust to the last leg.
      const n = BigInt(props.constituents.length);
      const perLeg = quoteAmount / n;
      const legs = props.constituents.map((token, i) => ({
        token,
        amount: (i === props.constituents.length - 1 ? quoteAmount - perLeg * (n - 1n) : perLeg).toString()
      }));

      setStatus("Fetching routes from Onchain OS Trade…");
      const response = await fetch("/api/quote", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({legs})
      });
      const body = (await response.json()) as {quotes?: Array<{data: `0x${string}`}>; error?: string};
      if (!response.ok || !body.quotes) throw new Error(body.error ?? "Could not fetch routes.");

      setStatus("Approving USD₮0…");
      const approval = await wallet.writeContract({
        account,
        address: props.quoteToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [props.basket, quoteAmount]
      });
      setStatus(`Approval sent (${approval.slice(0, 10)}…). Confirm the mint…`);

      // The first mint is exactly one share per whole quote token, so demand it.
      const minSharesOut = props.supplyIsZero ? quoteAmount * 10n ** 12n : 0n;

      const data = appendBuilderCode(
        encodeFunctionData({
          abi: thesisBasketAbi,
          functionName: "mint",
          args: [quoteAmount, minSharesOut, body.quotes.map((q) => q.data)]
        }),
        props.builderCode
      );

      const hash = await wallet.sendTransaction({account, to: props.basket, data});
      setStatus(`Minted. Transaction ${hash}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Mint failed.");
      setStatus("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="card-title">Mint {props.symbol}</div>
      <div className="card-theme">
        Pay in USD₮0. The basket buys every constituent at market and holds it.
      </div>
      <div className="controls">
        <input
          value={amount}
          inputMode="decimal"
          onChange={(e) => setAmount(e.target.value)}
          aria-label="Amount in USD₮0"
        />
        <button onClick={mint} disabled={busy}>
          {busy ? "Working…" : `Mint with ${amount || "0"} USD₮0`}
        </button>
      </div>
      {status && <p className="status mono">{status}</p>}
      {error && <p className="status error">{error}</p>}
    </div>
  );
}
