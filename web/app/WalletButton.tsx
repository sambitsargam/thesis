"use client";

import {useEffect, useState} from "react";
import {formatUnits} from "viem";
import {useWallet} from "./WalletProvider";

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export default function WalletButton() {
  const {account, wallet, wallets, searching, error, discover, connect, disconnect, dismiss} =
    useWallet();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);

  // Close the modal on Escape, the way a native dialog would.
  useEffect(() => {
    if (!open && wallets === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, wallets, dismiss]);

  useEffect(() => {
    if (!account) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    const read = async () => {
      try {
        const response = await fetch("/api/balances", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({account})
        });
        if (!response.ok) return;
        const body = (await response.json()) as {quote: string};
        if (!cancelled) setBalance(body.quote);
      } catch {
        // Balance is decoration; a failed read should not break the header.
      }
    };
    void read();
    const timer = setInterval(read, 12_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [account]);

  const showPicker = wallets !== null || searching;

  return (
    <>
      {account ? (
        <button className="account-pill" onClick={() => setOpen(true)}>
          {balance !== null && (
            <span className="pill-balance tnum">
              {Number(balance).toFixed(2)} USD₮0
            </span>
          )}
          <span className="pill-id">
            {wallet?.info.icon ? <img src={wallet.info.icon} alt="" aria-hidden="true" /> : null}
            {short(account)}
          </span>
        </button>
      ) : (
        <button className="connect" onClick={() => void discover()} disabled={searching}>
          {searching ? "Searching…" : "Connect wallet"}
        </button>
      )}

      {(showPicker || open) && (
        <div
          className="backdrop"
          onClick={() => {
            setOpen(false);
            dismiss();
          }}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            {account && open ? (
              <>
                <div className="modal-head">
                  <h3>Connected</h3>
                  <button
                    className="close"
                    onClick={() => setOpen(false)}
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                <div className="identity">
                  <div className="avatar" aria-hidden="true">
                    {wallet?.info.icon ? (
                      <img src={wallet.info.icon} alt="" />
                    ) : (
                      account.slice(2, 4).toUpperCase()
                    )}
                  </div>
                  <div>
                    <div className="identity-name">{short(account)}</div>
                    <div className="identity-sub">{wallet?.info.name} · X Layer</div>
                  </div>
                </div>
                {balance !== null && (
                  <div className="row" style={{marginTop: 18}}>
                    <span>USD₮0 balance</span>
                    <span className="tnum">{Number(balance).toFixed(6)}</span>
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    className="ghost"
                    onClick={() => void navigator.clipboard?.writeText(account)}
                  >
                    Copy address
                  </button>
                  <button
                    className="ghost danger"
                    onClick={() => {
                      disconnect();
                      setOpen(false);
                    }}
                  >
                    Disconnect
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="modal-head">
                  <h3>Connect a wallet</h3>
                  <button className="close" onClick={dismiss} aria-label="Close">
                    ✕
                  </button>
                </div>
                <p className="modal-sub">
                  Thesis never sees your keys. Everything is signed in your wallet.
                </p>
                {searching && <p className="status">Looking for wallets…</p>}
                <div className="wallet-list">
                  {(wallets ?? []).map((detected) => (
                    <button
                      key={detected.info.uuid}
                      className="wallet-row"
                      onClick={() => void connect(detected)}
                    >
                      <span className="wallet-mark">
                        {detected.info.icon ? (
                          <img src={detected.info.icon} alt="" aria-hidden="true" />
                        ) : (
                          detected.info.name.slice(0, 1)
                        )}
                      </span>
                      <span>{detected.info.name}</span>
                      <span className="wallet-go">→</span>
                    </button>
                  ))}
                </div>
                {error && <p className="status error">{error}</p>}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
