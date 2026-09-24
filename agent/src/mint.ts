import {createPublicClient, createWalletClient, encodeFunctionData, formatUnits, http} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {appendBuilderCode, deploymentFor, erc20Abi, thesisBasketAbi, xLayer} from "@thesis/shared";
import {fetchSwapQuote} from "@thesis/shared/okx";

const CHAIN_ID = 196;
const QUOTE_DECIMALS = 6;
const SHARE_DECIMALS = 18;

/**
 * Mints basket shares through Onchain OS Trade.
 *
 * Quotes are fetched per constituent and passed into `mint` as calldata, because the
 * OKX aggregator prices off-chain and no contract can call it mid-transaction. Prints
 * a plan and exits unless `--send` is passed.
 */
async function main(): Promise<void> {
  const send = process.argv.includes("--send");
  const amountArg = process.argv.find((a) => a.startsWith("--amount="))?.split("=")[1] ?? "3";
  const quoteAmount = BigInt(Math.round(Number(amountArg) * 10 ** QUOTE_DECIMALS));

  const deployment = deploymentFor(CHAIN_ID);
  const rpc = process.env.XLAYER_RPC_URL || xLayer.rpcUrls.default.http[0];
  const publicClient = createPublicClient({chain: xLayer, transport: http(rpc)});

  const basket = (process.env.BASKET_ADDRESS as `0x${string}`) ?? deployment.demoBasket;

  const [symbol, theme, constituents, supply] = await Promise.all([
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "symbol"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "theme"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "constituents"}),
    publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "totalSupply"})
  ]);

  console.log(`basket    ${symbol} @ ${basket}`);
  console.log(`theme     "${theme}"`);
  console.log(`supply    ${formatUnits(supply, SHARE_DECIMALS)}`);
  console.log(`spending  ${formatUnits(quoteAmount, QUOTE_DECIMALS)} USD₮0 across ${constituents.length} legs\n`);

  // Must match ThesisBasket._buyConstituents exactly: equal parts, dust to the last leg.
  const n = BigInt(constituents.length);
  const perLeg = quoteAmount / n;
  const legAmounts = constituents.map((_, i) =>
    i === constituents.length - 1 ? quoteAmount - perLeg * (n - 1n) : perLeg
  );

  const swapData: `0x${string}`[] = [];
  for (const [i, token] of constituents.entries()) {
    const quote = await fetchSwapQuote({
      chainId: CHAIN_ID,
      fromToken: deployment.quoteToken,
      toToken: token,
      amount: legAmounts[i]!,
      slippagePercent: process.env.SLIPPAGE_PERCENT ?? "1",
      // The adapter holds the tokens and receives the fill, never the end user.
      holder: deployment.router
    });

    if (quote.to.toLowerCase() !== deployment.okxDexRouter.toLowerCase()) {
      throw new Error(
        `Leg ${i}: OKX returned calldata for ${quote.to}, but the adapter only calls ${deployment.okxDexRouter}`
      );
    }

    console.log(
      `leg ${i}  ${formatUnits(legAmounts[i]!, QUOTE_DECIMALS)} USD₮0 -> ${token}` +
        `\n       expect ${formatUnits(quote.expectedOut, SHARE_DECIMALS)}  calldata ${quote.data.length / 2 - 1} bytes`
    );
    swapData.push(quote.data);
  }

  // The first mint prices one share per whole quote token, so this is exact.
  const minSharesOut =
    supply === 0n ? (quoteAmount * 10n ** BigInt(SHARE_DECIMALS)) / 10n ** BigInt(QUOTE_DECIMALS) : 0n;

  const data = appendBuilderCode(
    encodeFunctionData({
      abi: thesisBasketAbi,
      functionName: "mint",
      args: [quoteAmount, minSharesOut, swapData]
    }),
    process.env.BUILDER_CODE
  );

  console.log(`\nminSharesOut ${formatUnits(minSharesOut, SHARE_DECIMALS)}`);
  console.log(`calldata     ${data.length / 2 - 1} bytes`);

  if (!send) {
    console.log("\nDry run. Re-run with --send to submit.");
    return;
  }

  const key = process.env.DEPLOYER_PRIVATE_KEY;
  if (!key) throw new Error("DEPLOYER_PRIVATE_KEY is not set in .env");
  const account = privateKeyToAccount(key.startsWith("0x") ? (key as `0x${string}`) : `0x${key}`);
  const wallet = createWalletClient({account, chain: xLayer, transport: http(rpc)});

  const allowance = await publicClient.readContract({
    address: deployment.quoteToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, basket]
  });

  if (allowance < quoteAmount) {
    console.log("\napproving USD₮0...");
    const approveHash = await wallet.writeContract({
      address: deployment.quoteToken,
      abi: erc20Abi,
      functionName: "approve",
      args: [basket, quoteAmount]
    });
    await publicClient.waitForTransactionReceipt({hash: approveHash});
    console.log(`approved  ${approveHash}`);
  }

  console.log("\nminting...");
  const hash = await wallet.sendTransaction({to: basket, data});
  const receipt = await publicClient.waitForTransactionReceipt({hash});

  const shares = await publicClient.readContract({
    address: basket,
    abi: thesisBasketAbi,
    functionName: "balanceOf",
    args: [account.address]
  });

  console.log(`\n${receipt.status === "success" ? "minted" : "FAILED"}  ${hash}`);
  console.log(`shares    ${formatUnits(shares, SHARE_DECIMALS)} ${symbol}`);
  console.log(`explorer  https://www.oklink.com/xlayer/tx/${hash}`);
}

main().catch((error: unknown) => {
  console.error(`\n${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
