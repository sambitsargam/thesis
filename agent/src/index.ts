import {createPublicClient, http} from "viem";
import {xLayer, xLayerTestnet} from "@thesis/shared";

const chain = process.env.CHAIN_ID === "196" ? xLayer : xLayerTestnet;

/** Entry point for the persistent worker. Event watching lands in step 8. */
async function main(): Promise<void> {
  const client = createPublicClient({
    chain,
    transport: http(process.env.XLAYER_RPC_URL ?? chain.rpcUrls.default.http[0])
  });

  const blockNumber = await client.getBlockNumber();
  console.log(`[agent] connected to ${chain.name} (${chain.id}) at block ${blockNumber}`);
}

main().catch((error: unknown) => {
  console.error("[agent] fatal", error);
  process.exit(1);
});
