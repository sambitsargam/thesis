import {XSTOCK_CATALOG} from "./catalog";
import type {TokenizedEquity} from "./tokens";

const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
const MAX_CONSTITUENTS = 10;

export interface ResolvedTheme {
  tickers: string[];
  constituents: TokenizedEquity[];
  name: string;
  symbol: string;
  rationale: string;
  model: string;
}

function apiKey(): string {
  const key = process.env.OPENAI_API ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API is not set");
  return key;
}

/**
 * Turns a plain-language theme into a basket of real tokenized equities.
 *
 * The model is given the actual catalogue and told to choose only from it, then
 * every ticker it returns is matched back against that catalogue. Anything it
 * invents is discarded rather than trusted: a hallucinated ticker would deploy a
 * basket that can never be minted, and constituents are fixed at deployment.
 */
export async function resolveTheme(theme: string): Promise<ResolvedTheme> {
  const universe = XSTOCK_CATALOG.map((t) => `${t.ticker}=${t.name}`).join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You build equal-weight equity baskets from a fixed universe of tokenized stocks. " +
            "Choose between 2 and 10 tickers that best express the user's theme. " +
            "Only use tickers from the universe given; never invent one. " +
            "Prefer pure-play exposure over loosely related names, and avoid duplicating the " +
            "same company. Also propose a short basket name and a ticker suffix of 3-6 " +
            "uppercase letters. Keep the rationale to one sentence."
        },
        {
          role: "user",
          content: `Theme: ${theme}\n\nUniverse (TICKER=Company):\n${universe}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "basket",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["tickers", "name", "symbol", "rationale"],
            properties: {
              tickers: {type: "array", items: {type: "string"}},
              name: {type: "string"},
              symbol: {type: "string"},
              rationale: {type: "string"}
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`OpenAI ${response.status}: ${detail.slice(0, 200)}`);
  }

  const body = (await response.json()) as {
    model?: string;
    choices?: Array<{message?: {content?: string}}>;
  };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no content");

  const parsed = JSON.parse(content) as {
    tickers: string[];
    name: string;
    symbol: string;
    rationale: string;
  };

  // Keep only tickers that exist in the catalogue, de-duplicated, capped.
  const seen = new Set<string>();
  const constituents: TokenizedEquity[] = [];
  for (const ticker of parsed.tickers) {
    const match = XSTOCK_CATALOG.find(
      (t) => t.ticker.toLowerCase() === ticker.trim().toLowerCase()
    );
    if (!match || seen.has(match.address)) continue;
    seen.add(match.address);
    constituents.push(match);
    if (constituents.length === MAX_CONSTITUENTS) break;
  }

  if (constituents.length === 0) {
    throw new Error("No tokenized equity on X Layer matches that theme.");
  }

  return {
    tickers: constituents.map((c) => c.ticker),
    constituents,
    name: parsed.name?.trim().slice(0, 48) || theme.slice(0, 48),
    symbol: (parsed.symbol || "IDX").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6),
    rationale: parsed.rationale?.trim() ?? "",
    model: body.model ?? DEFAULT_MODEL
  };
}
