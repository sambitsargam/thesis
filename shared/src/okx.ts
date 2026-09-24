import {createHmac} from "node:crypto";

const BASE_URL = "https://web3.okx.com";
const SWAP_PATH = "/api/v6/dex/aggregator/swap";

export interface SwapQuote {
  /** Calldata to forward to the OKX DexRouter. */
  data: `0x${string}`;
  /** Address the calldata must be sent to. Must equal the configured DexRouter. */
  to: string;
  /** Aggregator's expected output, in the destination token's smallest units. */
  expectedOut: bigint;
  minReceive: bigint;
}

interface Credentials {
  apiKey: string;
  secret: string;
  passphrase: string;
}

export function credentialsFromEnv(): Credentials {
  const apiKey = process.env.OKX_API_KEY;
  const secret = process.env.OKX_API_SECRET ?? process.env.OKX_SECRET_KEY;
  const passphrase = process.env.OKX_API_PASSPHRASE ?? process.env.OKX_PASSPHRASE;

  if (!apiKey || !secret || !passphrase) {
    throw new Error(
      "Missing OKX credentials. Set OKX_API_KEY, OKX_API_SECRET and OKX_API_PASSPHRASE in .env"
    );
  }
  return {apiKey, secret, passphrase};
}

/**
 * OKX signs `timestamp + METHOD + requestPath + body`, HMAC-SHA256 with the API
 * secret, base64 encoded. The request path must include the query string exactly
 * as sent, so the same string is used for both the signature and the fetch.
 */
function sign(creds: Credentials, method: string, requestPath: string): Record<string, string> {
  const timestamp = new Date().toISOString();
  const prehash = `${timestamp}${method}${requestPath}`;
  const signature = createHmac("sha256", creds.secret).update(prehash).digest("base64");

  return {
    "OK-ACCESS-KEY": creds.apiKey,
    "OK-ACCESS-SIGN": signature,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": creds.passphrase,
    "Content-Type": "application/json"
  };
}

/**
 * Fetches executable swap calldata from the OKX aggregator.
 *
 * `holder` is the contract that will hold the input tokens and receive the output —
 * for Thesis that is always the OkxTradeRouter adapter, never the end user.
 */
/** Retries a 429 with backoff. The aggregator rate limits bursts of quotes. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const rateLimited = error instanceof Error && /429|50011|Too Many Requests/i.test(error.message);
      if (!rateLimited || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * 2 ** attempt));
    }
  }
  throw lastError;
}

/**
 * Quotes several legs without tripping the aggregator's rate limit.
 *
 * Quotes are fetched one at a time with a short gap. Firing them in parallel
 * returns 429 for baskets of more than about three constituents, which would
 * make those baskets permanently unmintable.
 */
export async function fetchSwapQuotes(
  legs: Array<{token: string; amount: bigint}>,
  common: {chainId: number; fromToken: string; slippagePercent: string; holder: string}
): Promise<SwapQuote[]> {
  const quotes: SwapQuote[] = [];
  for (const [index, leg] of legs.entries()) {
    if (index > 0) await new Promise((resolve) => setTimeout(resolve, 220));
    quotes.push(
      await withRetry(() =>
        fetchSwapQuote({
          chainId: common.chainId,
          fromToken: common.fromToken,
          toToken: leg.token,
          amount: leg.amount,
          slippagePercent: common.slippagePercent,
          holder: common.holder
        })
      )
    );
  }
  return quotes;
}

export async function fetchSwapQuote(params: {
  chainId: number;
  fromToken: string;
  toToken: string;
  amount: bigint;
  slippagePercent: string;
  holder: string;
}): Promise<SwapQuote> {
  const creds = credentialsFromEnv();

  const query = new URLSearchParams({
    chainIndex: String(params.chainId),
    chainId: String(params.chainId),
    amount: params.amount.toString(),
    fromTokenAddress: params.fromToken,
    toTokenAddress: params.toToken,
    slippagePercent: params.slippagePercent,
    userWalletAddress: params.holder,
    swapReceiverAddress: params.holder
  });

  const requestPath = `${SWAP_PATH}?${query.toString()}`;
  const response = await fetch(`${BASE_URL}${requestPath}`, {
    method: "GET",
    headers: sign(creds, "GET", requestPath)
  });

  const body = (await response.json()) as {
    code?: string;
    msg?: string;
    data?: Array<{
      tx?: {data?: string; to?: string; minReceiveAmount?: string};
      routerResult?: {toTokenAmount?: string};
    }>;
  };

  if (!response.ok || body.code !== "0") {
    throw new Error(`OKX swap API ${response.status}: code=${body.code} msg=${body.msg}`);
  }

  const quote = body.data?.[0];
  if (!quote?.tx?.data || !quote.tx.to) {
    throw new Error(`OKX swap API returned no transaction for ${params.fromToken} -> ${params.toToken}`);
  }

  return {
    data: quote.tx.data as `0x${string}`,
    to: quote.tx.to,
    expectedOut: BigInt(quote.routerResult?.toTokenAmount ?? "0"),
    minReceive: BigInt(quote.tx.minReceiveAmount ?? "0")
  };
}
