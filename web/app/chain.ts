import {createPublicClient, http} from "viem";
import {deploymentFor, xLayer} from "@thesis/shared";

export const CHAIN_ID = 196;
export const deployment = deploymentFor(CHAIN_ID);

export const publicClient = createPublicClient({
  chain: xLayer,
  transport: http(process.env.XLAYER_RPC_URL || xLayer.rpcUrls.default.http[0]),
  // Reads are gathered into Multicall3 calls instead of one request each, which is the
  // difference between a listing page that paints and one that crawls.
  batch: {multicall: {wait: 12}}
});

export const explorer = (path: string) => `https://www.oklink.com/xlayer/${path}`;
