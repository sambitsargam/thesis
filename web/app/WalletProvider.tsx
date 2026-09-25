"use client";

import {createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {createWalletClient, custom, type WalletClient} from "viem";
import {builderCodeSuffix, xLayer} from "@thesis/shared";

export interface Eip1193Provider {
  request(args: {method: string; params?: unknown[]}): Promise<unknown>;
}

export interface DetectedWallet {
  info: {uuid: string; name: string; icon: string; rdns: string};
  provider: Eip1193Provider;
}

interface WalletState {
  wallet: DetectedWallet | null;
  account: `0x${string}` | null;
  client: WalletClient | null;
  wallets: DetectedWallet[] | null;
  searching: boolean;
  error: string;
  discover: () => Promise<DetectedWallet[]>;
  connect: (wallet: DetectedWallet) => Promise<void>;
  disconnect: () => void;
  dismiss: () => void;
}

const WalletContext = createContext<WalletState | null>(null);

/** Which wallet the visitor last chose, so the session survives a page load. */
const REMEMBERED = "thesis.wallet.rdns";

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent<DetectedWallet>;
  }
}

export function WalletProvider({
  children,
  builderCode
}: {
  children: ReactNode;
  builderCode?: string;
}) {
  // One suffix for the whole app: set on the client, so every transaction it sends
  // carries attribution — approvals included — with no per-call bookkeeping.
  const DATA_SUFFIX = useMemo(() => builderCodeSuffix(builderCode), [builderCode]);
  const [wallet, setWallet] = useState<DetectedWallet | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [wallets, setWallets] = useState<DetectedWallet[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  /**
   * EIP-6963 discovery, run only on demand. Announcing on mount makes some
   * wallets open themselves, which reads as the site connecting uninvited.
   */
  const discover = useCallback(async () => {
    setSearching(true);
    setError("");
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
    if (list.length === 0) setError("No wallet detected. Install OKX Wallet, MetaMask or Rabby.");
    return list;
  }, []);

  /**
   * Restores a previous session without prompting.
   *
   * `eth_accounts` reports an existing authorisation and never opens the wallet,
   * unlike `eth_requestAccounts`. Without this, a full page load drops the
   * connection and the app asks a visitor to reconnect on every navigation.
   */
  useEffect(() => {
    const rdns = localStorage.getItem(REMEMBERED);
    if (!rdns) return;

    let cancelled = false;
    const onAnnounce = async (event: CustomEvent<DetectedWallet>) => {
      if (cancelled || event.detail.info.rdns !== rdns) return;
      try {
        const accounts = (await event.detail.provider.request({
          method: "eth_accounts"
        })) as string[];
        if (cancelled || !accounts?.[0]) return;
        setWallet(event.detail);
        setAccount(accounts[0] as `0x${string}`);
      } catch {
        // Wallet locked or permission revoked: stay disconnected, prompt nothing.
      }
    };

    window.addEventListener("eip6963:announceProvider", onAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => {
      cancelled = true;
      window.removeEventListener("eip6963:announceProvider", onAnnounce);
    };
  }, []);

  const connect = useCallback(async (detected: DetectedWallet) => {
    setError("");
    try {
      const client = createWalletClient({
        chain: xLayer,
        transport: custom(detected.provider),
        dataSuffix: DATA_SUFFIX
      });
      const [address] = await client.requestAddresses();
      if (!address) throw new Error("No account authorised.");
      await client.switchChain({id: xLayer.id}).catch(() => undefined);
      setWallet(detected);
      setAccount(address);
      setWallets(null);
      localStorage.setItem(REMEMBERED, detected.info.rdns);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message.split("\n")[0]! : "Could not connect.");
    }
  }, []);

  const disconnect = useCallback(() => {
    localStorage.removeItem(REMEMBERED);
    setWallet(null);
    setAccount(null);
    setWallets(null);
    setError("");
  }, []);

  const dismiss = useCallback(() => {
    setWallets(null);
    setError("");
  }, []);

  const client = useMemo(
    () =>
      wallet
        ? createWalletClient({
            chain: xLayer,
            transport: custom(wallet.provider),
            dataSuffix: DATA_SUFFIX
          })
        : null,
    [wallet]
  );

  const value = useMemo(
    () => ({
      wallet,
      account,
      client,
      wallets,
      searching,
      error,
      discover,
      connect,
      disconnect,
      dismiss
    }),
    [wallet, account, client, wallets, searching, error, discover, connect, disconnect, dismiss]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletState {
  const context = useContext(WalletContext);
  if (!context) throw new Error("useWallet must be used inside WalletProvider");
  return context;
}
