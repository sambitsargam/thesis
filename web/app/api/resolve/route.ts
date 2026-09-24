import {NextResponse} from "next/server";
import {resolveTheme} from "@thesis/shared/ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Turns a plain-language theme into real, routable constituents. */
export async function POST(request: Request) {
  try {
    const {theme} = (await request.json()) as {theme?: string};
    if (!theme || theme.trim().length < 3) {
      return NextResponse.json({error: "Describe the theme in a few words."}, {status: 400});
    }

    const resolved = await resolveTheme(theme);
    return NextResponse.json({
      name: resolved.name,
      symbol: resolved.symbol,
      rationale: resolved.rationale,
      model: resolved.model,
      constituents: resolved.constituents
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Could not resolve the theme";
    return NextResponse.json({error: message}, {status: 502});
  }
}
