"use client";

import {useEffect, useState} from "react";

export interface Eip1193Provider {
  request(args: {method: string; params?: unknown[]}): Promise<unknown>;
  on?(event: string, handler: (...args: unknown[]) => void): void;
  removeListener?(event: string, handler: (...args: unknown[]) => void): void;
}

export interface WalletInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

export interface DetectedWallet {
  info: WalletInfo;
  provider: Eip1193Provider;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<DetectedWallet>;
  }
}

/**
 * Discovers every injected wallet via EIP-6963.
 *
 * Without this, several wallets race to own `window.ethereum` and whichever
 * loaded last wins — which is why a page can insist on opening Phantom when the
 * user wanted OKX Wallet. Wallets that predate EIP-6963 are added as a fallback
 * entry so they remain usable.
 */
export function useWallets(): DetectedWallet[] {
  const [wallets, setWallets] = useState<DetectedWallet[]>([]);

  useEffect(() => {
    const onAnnounce = (event: CustomEvent<DetectedWallet>) => {
      setWallets((current) =>
        current.some((w) => w.info.uuid === event.detail.info.uuid)
          ? current
          : [...current, event.detail]
      );
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));

    // Give announcements a moment, then fall back to the legacy global if nothing replied.
    const timer = setTimeout(() => {
      setWallets((current) => {
        if (current.length > 0 || !window.ethereum) return current;
        return [
          {
            info: {uuid: "injected", name: "Browser wallet", icon: "", rdns: "injected"},
            provider: window.ethereum
          }
        ];
      });
    }, 300);

    return () => {
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
      clearTimeout(timer);
    };
  }, []);

  return wallets;
}
