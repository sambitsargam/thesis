import {createPublicClient, http} from "viem";
import {deploymentFor, xLayer} from "@thesis/shared";

export const CHAIN_ID = 196;
export const deployment = deploymentFor(CHAIN_ID);

export const publicClient = createPublicClient({
  chain: xLayer,
  transport: http(process.env.XLAYER_RPC_URL || xLayer.rpcUrls.default.http[0])
});

export const explorer = (path: string) => `https://www.oklink.com/xlayer/${path}`;
