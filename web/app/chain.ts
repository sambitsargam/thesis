import {createPublicClient, fallback, http} from "viem";
import {deploymentFor, xLayer} from "@thesis/shared";

export const CHAIN_ID = 196;
export const deployment = deploymentFor(CHAIN_ID);

/*
 * Two endpoints, and a wider batching window.
 *
 * Loading sixteen baskets made the public node answer "over rate limit" mid-render, which
 * a server component turns into a 500. A second endpoint takes over when the first
 * refuses, and a 60ms window gathers far more of the reads into each Multicall3 call
 * rather than letting them trickle out individually.
 */
export const publicClient = createPublicClient({
  chain: xLayer,
  transport: fallback(
    [
      http(process.env.XLAYER_RPC_URL || xLayer.rpcUrls.default.http[0]),
      http(xLayer.rpcUrls.default.http[1] ?? xLayer.rpcUrls.default.http[0])
    ],
    {retryCount: 2}
  ),
  batch: {multicall: {wait: 60}}
});

export const explorer = (path: string) => `https://www.oklink.com/xlayer/${path}`;
