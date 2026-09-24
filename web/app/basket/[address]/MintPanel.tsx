"use client";

import {useState} from "react";
import {createWalletClient, custom, encodeFunctionData, parseUnits} from "viem";
import {appendBuilderCode, erc20Abi, thesisBasketAbi, xLayer} from "@thesis/shared";
import {type DetectedWallet, useWalletDiscovery} from "../../wallets";

const QUOTE_DECIMALS = 6;

interface Props {
  basket: `0x${string}`;
  symbol: string;
  quoteToken: `0x${string}`;
  constituents: readonly `0x${string}`[];
  supplyIsZero: boolean;
  builderCode?: string;
}

type Phase = "idle" | "quoting" | "approving" | "minting" | "done";

export default function MintPanel(props: Props) {
  const {wallets, searching, discover, reset} = useWalletDiscovery();
  const [wallet, setWallet] = useState<DetectedWallet | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [amount, setAmount] = useState("3");
  const [phase, setPhase] = useState<Phase>("idle");
  const [txHash, setTxHash] = useState<string>("");
  const [error, setError] = useState("");

  async function chooseWallet() {
    setError("");
    const found = await discover();
    if (found.length === 0) {
      setError("No wallet found. Install OKX Wallet, MetaMask or Rabby, then try again.");
    }
  }

  async function connect(detected: DetectedWallet) {
    setError("");
    try {
      const client = createWalletClient({chain: xLayer, transport: custom(detected.provider)});
      const [address] = await client.requestAddresses();
      if (!address) throw new Error("No account authorised.");
      await client.switchChain({id: xLayer.id}).catch(() => undefined);
      setWallet(detected);
      setAccount(address);
      reset();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not connect.");
    }
  }

  function disconnect() {
    setWallet(null);
    setAccount(null);
    setPhase("idle");
    setTxHash("");
    setError("");
    reset();
  }

  async function mint() {
    if (!wallet || !account) return;
    setError("");
    setTxHash("");
    try {
      const quoteAmount = parseUnits(amount, QUOTE_DECIMALS);
      if (quoteAmount <= 0n) throw new Error("Enter an amount above zero.");

      const client = createWalletClient({chain: xLayer, transport: custom(wallet.provider)});

      // Split exactly as ThesisBasket does: equal parts, division dust to the last leg.
      const n = BigInt(props.constituents.length);
      const perLeg = quoteAmount / n;
      const legs = props.constituents.map((token, i) => ({
        token,
        amount: (i === props.constituents.length - 1
          ? quoteAmount - perLeg * (n - 1n)
          : perLeg
        ).toString()
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
      await client.writeContract({
        account,
        address: props.quoteToken,
        abi: erc20Abi,
        functionName: "approve",
        args: [props.basket, quoteAmount]
      });

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

      setPhase("minting");
      const hash = await client.sendTransaction({account, to: props.basket, data});
      setTxHash(hash);
      setPhase("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message.split("\n")[0]! : "Mint failed.");
      setPhase("idle");
    }
  }

  const busy = phase === "quoting" || phase === "approving" || phase === "minting";
  const label: Record<Phase, string> = {
    idle: `Mint with ${amount || "0"} USD₮0`,
    quoting: "Pricing each leg…",
    approving: "Approve in your wallet…",
    minting: "Confirm the mint…",
    done: `Mint more ${props.symbol}`
  };

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">Mint {props.symbol}</div>
          <div className="card-theme">
            One transaction buys every constituent at market and holds it.
          </div>
        </div>
      </div>

      {!account ? (
        wallets === null ? (
          <div className="controls">
            <button onClick={chooseWallet} disabled={searching}>
              {searching ? "Looking for wallets…" : "Connect wallet"}
            </button>
          </div>
        ) : (
          <div className="wallets">
            {wallets.map((detected) => (
              <button key={detected.info.uuid} className="wallet" onClick={() => connect(detected)}>
                {detected.info.icon ? <img src={detected.info.icon} alt="" aria-hidden="true" /> : null}
                {detected.info.name}
              </button>
            ))}
            <button className="linkish" onClick={reset}>
              cancel
            </button>
          </div>
        )
      ) : (
        <>
          <div className="account">
            <span className="who">
              {wallet?.info.name} · {account.slice(0, 6)}…{account.slice(-4)}
            </span>
            <button className="linkish" onClick={disconnect}>
              change wallet
            </button>
          </div>
          <div className="controls">
            <input
              className="amount"
              value={amount}
              inputMode="decimal"
              onChange={(e) => setAmount(e.target.value)}
              aria-label="Amount in USD₮0"
            />
            <button onClick={mint} disabled={busy}>
              {label[phase]}
            </button>
          </div>
        </>
      )}

      {txHash && (
        <p className="status done">
          Minted ·{" "}
          <a className="mono link" href={`https://www.oklink.com/xlayer/tx/${txHash}`}>
            {txHash.slice(0, 18)}…
          </a>
        </p>
      )}
      {error && <p className="status error">{error}</p>}
    </div>
  );
}
