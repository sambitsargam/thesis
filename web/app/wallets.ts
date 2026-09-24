"use client";

import {useCallback, useState} from "react";

export interface Eip1193Provider {
  request(args: {method: string; params?: unknown[]}): Promise<unknown>;
}

export interface DetectedWallet {
  info: {uuid: string; name: string; icon: string; rdns: string};
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
 * Discovers injected wallets via EIP-6963, but only when asked.
 *
 * Discovery is deliberately not run on mount: some wallets react to a provider
 * request by opening themselves, which reads as the page connecting on its own.
 * Nothing here touches a provider until the visitor clicks.
 */
export function useWalletDiscovery() {
  const [wallets, setWallets] = useState<DetectedWallet[] | null>(null);
  const [searching, setSearching] = useState(false);

  const discover = useCallback(async (): Promise<DetectedWallet[]> => {
    setSearching(true);
    const found = new Map<string, DetectedWallet>();

    const onAnnounce = (event: CustomEvent<DetectedWallet>) => {
      found.set(event.detail.info.uuid, event.detail);
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    await new Promise((resolve) => setTimeout(resolve, 250));
    window.removeEventListener("eip6963:announceProvider", onAnnounce);

    if (found.size === 0 && window.ethereum) {
      found.set("injected", {
        info: {uuid: "injected", name: "Browser wallet", icon: "", rdns: "injected"},
        provider: window.ethereum
      });
    }

    const list = [...found.values()];
    setWallets(list);
    setSearching(false);
    return list;
  }, []);

  const reset = useCallback(() => setWallets(null), []);

  return {wallets, searching, discover, reset};
}
