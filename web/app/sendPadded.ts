import type {WalletClient} from "viem";

/**
 * Sends a transaction with a third more gas than the wallet estimates.
 *
 * Mints and rebalances are one nested swap per constituent, and estimation runs tight
 * enough that a four-leg basket has reverted with OutOfGas *after* every swap already
 * filled — burning the gas and leaving nothing minted. Unused gas is refunded, so the
 * headroom costs nothing; a failed transaction in front of someone does.
 *
 * If the estimate itself fails, the transaction is sent without a limit and the wallet
 * falls back to its own estimation rather than refusing to send at all.
 */
export async function sendPadded(
  client: WalletClient,
  account: `0x${string}`,
  to: `0x${string}`,
  data: `0x${string}`
): Promise<`0x${string}`> {
  const estimate = await client
    .request({method: "eth_estimateGas", params: [{from: account, to, data}]})
    .then((value) => BigInt(value as string))
    .catch(() => undefined);

  return client.sendTransaction({
    account,
    chain: null,
    to,
    data,
    ...(estimate ? {gas: (estimate * 4n) / 3n} : {})
  });
}
