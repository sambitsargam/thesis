import {NextResponse} from "next/server";
import {deepResearch} from "@thesis/shared/research";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Searches the open web, then builds a basket grounded in what it found. */
export async function POST(request: Request) {
  try {
    const {theme} = (await request.json()) as {theme?: string};
    if (!theme || theme.trim().length < 3) {
      return NextResponse.json({error: "Describe the theme in a few words."}, {status: 400});
    }
    return NextResponse.json(await deepResearch(theme));
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Research failed";
    return NextResponse.json({error: message}, {status: 502});
  }
}
