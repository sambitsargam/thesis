import {createPublicClient, createWalletClient, decodeEventLog, http} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {
  builderCodeSuffix,
  deploymentFor,
  MAX_FEE_BPS,
  thesisFactoryAbi,
  xLayer
} from "@thesis/shared";
import {equityFor, searchEquities} from "@thesis/shared/catalog";
import {fetchSwapQuote} from "@thesis/shared/okx";

const CHAIN_ID = 196;
const QUOTE_DECIMALS = 6;
const PROBE = 1_000_000n; // 1 USD₮0, enough to prove a route exists.

function flag(name: string, fallback: string): string {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1] ?? fallback;
}

/**
 * Deploys a basket through the V2 factory, with a creator fee.
 *
 * Every constituent is quoted first: weights are fixed at deployment, so one unroutable
 * holding would make the basket permanently unmintable. Prints a plan and exits unless
 * `--send` is passed.
 *
 * Usage: pnpm launch --theme="..." --symbol=NUKE --tickers=NVDAx,TSLAx --fee=30 [--send]
 */
async function main(): Promise<void> {
  const send = process.argv.includes("--send");
  const theme = flag("theme", "US megacap technology, equal weight");
  const symbol = flag("symbol", "MEGA").toUpperCase();
  const feeBps = BigInt(flag("fee", "30"));
  const tickers = flag("tickers", "NVDAx,TSLAx,SPYx")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (feeBps > MAX_FEE_BPS) {
    throw new Error(`fee ${feeBps} bps is above the contract's cap of ${MAX_FEE_BPS}`);
  }

  const deployment = deploymentFor(CHAIN_ID);
  const factory = deployment.factoryV2;
  if (!factory) throw new Error("No V2 factory recorded for this chain; deploy it first.");

  // Tickers resolve against the routable catalogue, never against free text.
  const constituents = tickers.map((ticker) => {
    const match =
      searchEquities(ticker, 50).find((e) => e.ticker.toLowerCase() === ticker.toLowerCase()) ??
      equityFor(ticker);
    if (!match) throw new Error(`${ticker} is not a tokenized equity with liquidity on X Layer`);
    return match;
  });

  const name = `Thesis ${theme}`.slice(0, 64);
  const fullSymbol = `THESIS-${symbol}`.slice(0, 20);

  console.log(`factory   ${factory} (V2)`);
  console.log(`basket    ${name} · ${fullSymbol}`);
  console.log(`theme     "${theme}"`);
  console.log(`fee       ${Number(feeBps) / 100}% of every mint, to the creator`);
  console.log(`weight    ${(100 / constituents.length).toFixed(2)}% each\n`);

  for (const equity of constituents) {
    // A basket holding an unroutable equity can never be minted, so prove each leg first.
    const quote = await fetchSwapQuote({
      chainId: CHAIN_ID,
      fromToken: deployment.quoteToken,
      toToken: equity.address,
      amount: PROBE,
      slippagePercent: "1",
      holder: deployment.router
    });
    console.log(
      `routes ok ${equity.ticker.padEnd(8)} ${equity.address}  1 USD₮0 -> ${Number(quote.expectedOut) / 1e18}`
    );
  }

  if (!send) {
    console.log("\nDry run. Re-run with --send to deploy.");
    return;
  }

  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("DEPLOYER_PRIVATE_KEY is not set in .env");
  const account = privateKeyToAccount(key.startsWith("0x") ? (key as `0x${string}`) : `0x${key}`);

  const rpc = process.env.XLAYER_RPC_URL || xLayer.rpcUrls.default.http[0];
  const publicClient = createPublicClient({chain: xLayer, transport: http(rpc)});
  const wallet = createWalletClient({
    account,
    chain: xLayer,
    transport: http(rpc),
    // ERC-8021 attribution on the launch itself, not only on mints.
    dataSuffix: builderCodeSuffix(process.env.BUILDER_CODE)
  });

  console.log("\ndeploying...");
  const hash = await wallet.writeContract({
    address: factory,
    abi: thesisFactoryAbi,
    functionName: "createBasket",
    args: [name, fullSymbol, theme, constituents.map((e) => e.address as `0x${string}`), feeBps]
  });
  const receipt = await publicClient.waitForTransactionReceipt({hash});

  const created = receipt.logs
    .map((log) => {
      try {
        return decodeEventLog({abi: thesisFactoryAbi, data: log.data, topics: log.topics});
      } catch {
        // Logs from the basket's own construction decode against a different ABI.
        return undefined;
      }
    })
    .find((event) => event?.eventName === "BasketCreated");

  const basket =
    created && "args" in created ? (created.args as {basket: string}).basket : undefined;

  console.log(`\n${receipt.status === "success" ? "deployed" : "FAILED"}  ${hash}`);
  if (basket) console.log(`basket    ${basket}`);
  console.log(`explorer  https://www.oklink.com/xlayer/tx/${hash}`);
  if (basket) console.log(`\nMint into it:\n  BASKET_ADDRESS=${basket} pnpm mint --amount=2 --send`);
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
