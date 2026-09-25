import {XSTOCK_CATALOG} from "./catalog";
import type {TokenizedEquity} from "./tokens";

const SEARCH_MODEL = process.env.OPENAI_SEARCH_MODEL ?? "gpt-4o";
const PICK_MODEL = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

export interface Source {
  title: string;
  url: string;
}

export interface ResearchPick {
  ticker: string;
  address: `0x${string}`;
  name: string;
  reason: string;
}

export interface ResearchBriefing {
  theme: string;
  briefing: string;
  outlook: string;
  risks: string;
  sources: Source[];
  picks: ResearchPick[];
  basketName: string;
  symbol: string;
  searches: number;
  models: {search: string; select: string};
}

function apiKey(): string {
  const key = process.env.OPENAI_API ?? process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API is not set");
  return key;
}

interface ResponseOutput {
  type: string;
  content?: Array<{
    type: string;
    text?: string;
    annotations?: Array<{type: string; url?: string; title?: string}>;
  }>;
}

/**
 * Phase one: search the open web for current context on a theme.
 *
 * Returns the model's write-up plus every page it actually cited, so a reader can
 * check the reasoning rather than take it on trust.
 */
async function searchTheme(theme: string): Promise<{text: string; sources: Source[]; searches: number}> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json"},
    body: JSON.stringify({
      model: SEARCH_MODEL,
      tools: [{type: "web_search_preview"}],
      input:
        `Research the investment theme "${theme}" using current sources.\n\n` +
        "Cover: what is driving the theme right now, which listed companies have the most " +
        "direct exposure, recent developments in the last few months, and the main risks. " +
        "Name specific companies and their stock tickers. Be concrete and cite sources. " +
        "Write no more than 300 words. Do not give investment advice or price targets."
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI search ${response.status}: ${(await response.text()).slice(0, 180)}`);
  }

  const body = (await response.json()) as {output?: ResponseOutput[]};
  const output = body.output ?? [];

  const searches = output.filter((o) => o.type === "web_search_call").length;
  const message = output.find((o) => o.type === "message");
  const block = message?.content?.find((c) => c.type === "output_text");
  const text = block?.text ?? "";

  const seen = new Set<string>();
  const sources: Source[] = [];
  for (const annotation of block?.annotations ?? []) {
    if (annotation.type !== "url_citation" || !annotation.url || seen.has(annotation.url)) continue;
    seen.add(annotation.url);
    sources.push({title: annotation.title ?? new URL(annotation.url).hostname, url: annotation.url});
  }

  if (!text) throw new Error("The research step returned nothing.");
  return {text, sources, searches};
}

/**
 * Phase two: turn the research into constituents that actually exist on X Layer.
 *
 * Kept separate from the search so selection is constrained by the real catalogue.
 * Every ticker is matched back against it and unknown ones are dropped.
 */
async function selectFromResearch(
  theme: string,
  research: string
): Promise<Omit<ResearchBriefing, "sources" | "searches" | "models" | "theme">> {
  const universe = XSTOCK_CATALOG.map((t) => `${t.ticker}=${t.name}`).join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json"},
    body: JSON.stringify({
      model: PICK_MODEL,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "You turn a research briefing into an equal-weight basket, choosing only from a " +
            "fixed universe of tokenized stocks. Pick 3 to 8 tickers with the most direct " +
            "exposure to the theme. Give one short reason per pick, grounded in the briefing. " +
            "Summarise the outlook in one sentence and the main risks in one sentence. " +
            "Never invent a ticker. Describe, do not advise."
        },
        {
          role: "user",
          content: `Theme: ${theme}\n\nResearch:\n${research}\n\nUniverse (TICKER=Company):\n${universe}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "briefing",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["picks", "outlook", "risks", "basketName", "symbol"],
            properties: {
              picks: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["ticker", "reason"],
                  properties: {ticker: {type: "string"}, reason: {type: "string"}}
                }
              },
              outlook: {type: "string"},
              risks: {type: "string"},
              basketName: {type: "string"},
              symbol: {type: "string"}
            }
          }
        }
      }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI selection ${response.status}: ${(await response.text()).slice(0, 180)}`);
  }

  const body = (await response.json()) as {choices?: Array<{message?: {content?: string}}>};
  const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as {
    picks?: Array<{ticker: string; reason: string}>;
    outlook?: string;
    risks?: string;
    basketName?: string;
    symbol?: string;
  };

  const seen = new Set<string>();
  const picks: ResearchPick[] = [];
  for (const pick of parsed.picks ?? []) {
    const match = XSTOCK_CATALOG.find(
      (t) => t.ticker.toLowerCase() === pick.ticker.trim().toLowerCase()
    );
    if (!match || seen.has(match.address)) continue;
    seen.add(match.address);
    picks.push({
      ticker: match.ticker,
      address: match.address,
      name: match.name,
      reason: pick.reason?.trim() ?? ""
    });
    if (picks.length === 8) break;
  }

  if (picks.length === 0) {
    throw new Error("Nothing in the X Layer catalogue matches that theme.");
  }

  return {
    briefing: research,
    outlook: parsed.outlook?.trim() ?? "",
    risks: parsed.risks?.trim() ?? "",
    picks,
    basketName: parsed.basketName?.trim().slice(0, 48) || theme.slice(0, 48),
    symbol: (parsed.symbol || "IDX").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6)
  };
}

/** Searches the web, then builds a basket grounded in what it found. */
export async function deepResearch(theme: string): Promise<ResearchBriefing> {
  const {text, sources, searches} = await searchTheme(theme);
  const selection = await selectFromResearch(theme, text);
  return {
    theme,
    ...selection,
    sources,
    searches,
    models: {search: SEARCH_MODEL, select: PICK_MODEL}
  };
}
