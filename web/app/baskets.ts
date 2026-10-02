import type {Address} from "viem";
import {basketCountersAbi, erc20Abi, thesisBasketAbi, thesisFactoryAbi} from "@thesis/shared";
import {deployment, publicClient} from "./chain";

/** What a basket holds of one constituent, right now. */
export interface Holding {
  token: Address;
  ticker: string;
  balance: bigint;
}

/** Lifetime totals kept by the basket itself. Absent on V1 baskets. */
export interface Counters {
  quoteIn: bigint;
  mints: number;
  creatorFees: bigint;
}

export interface BasketSummary {
  address: Address;
  name: string;
  symbol: string;
  theme: string;
  creator: Address;
  /** Which factory deployed it. V1 baskets charge no fee and keep no counters. */
  version: 1 | 2;
  feeBps: number;
  supply: bigint;
  constituents: readonly Address[];
  holdings: Holding[];
  counters: Counters | null;
}

async function loadBasket(address: Address, factory: Address, version: 1 | 2): Promise<BasketSummary> {
  const [name, symbol, theme, constituents, supply] = await Promise.all([
    publicClient.readContract({address, abi: thesisBasketAbi, functionName: "name"}),
    publicClient.readContract({address, abi: thesisBasketAbi, functionName: "symbol"}),
    publicClient.readContract({address, abi: thesisBasketAbi, functionName: "theme"}),
    publicClient.readContract({address, abi: thesisBasketAbi, functionName: "constituents"}),
    publicClient.readContract({address, abi: thesisBasketAbi, functionName: "totalSupply"})
  ]);

  const [creator, feeBps] = await Promise.all([
    publicClient.readContract({
      address: factory,
      abi: thesisFactoryAbi,
      functionName: "creatorOf",
      args: [address]
    }),
    // V1 baskets predate the fee entirely; a missing function reads as no fee.
    publicClient
      .readContract({address, abi: thesisBasketAbi, functionName: "feeBps"})
      .catch(() => 0n)
  ]);

  const holdings = await Promise.all(
    constituents.map(async (token) => {
      const [ticker, balance] = await Promise.all([
        publicClient
          .readContract({address: token, abi: erc20Abi, functionName: "symbol"})
          .catch(() => "?"),
        publicClient.readContract({
          address: token,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address]
        })
      ]);
      return {token, ticker, balance};
    })
  );

  return {
    address,
    name,
    symbol,
    theme,
    creator,
    version,
    feeBps: Number(feeBps),
    supply,
    constituents,
    holdings,
    counters: await loadCounters(address)
  };
}

/**
 * Lifetime totals, straight from the basket.
 *
 * Baskets deployed before these counters existed do not implement them, and the call
 * reverts rather than returning zero — which is the honest answer: those baskets have
 * no recorded history, and showing 0 would read as "nobody ever minted".
 */
async function loadCounters(address: Address): Promise<Counters | null> {
  try {
    const [quoteIn, mints, creatorFees] = await Promise.all([
      publicClient.readContract({address, abi: basketCountersAbi, functionName: "totalQuoteIn"}),
      publicClient.readContract({address, abi: basketCountersAbi, functionName: "mintCount"}),
      publicClient.readContract({address, abi: basketCountersAbi, functionName: "totalCreatorFees"})
    ]);
    return {quoteIn, mints: Number(mints), creatorFees};
  } catch {
    return null;
  }
}

/**
 * Every basket from every factory, newest version last.
 *
 * Both factories are always read. V1 is the one the submission was judged on and stays
 * live; V2 adds the creator fee and the counters.
 */
export async function loadBaskets(): Promise<BasketSummary[]> {
  const factories: [Address, 1 | 2][] = [[deployment.factory, 1]];
  if (deployment.factoryV2) factories.push([deployment.factoryV2, 2]);

  const sets = await Promise.all(
    factories.map(async ([factory, version]) => {
      const addresses = await publicClient.readContract({
        address: factory,
        abi: thesisFactoryAbi,
        functionName: "baskets"
      });
      return Promise.all(addresses.map((address) => loadBasket(address, factory, version)));
    })
  );

  return sets.flat();
}
