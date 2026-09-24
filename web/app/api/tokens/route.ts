import {NextResponse} from "next/server";
import {searchEquities, XSTOCK_CATALOG} from "@thesis/shared/catalog";

export const runtime = "nodejs";

/**
 * Searches the tokenized-equity catalogue.
 *
 * The catalogue stays on the server: several hundred entries would be dead weight
 * in a browser bundle, and the client only ever needs the handful it is showing.
 */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q") ?? "";
  return NextResponse.json({
    total: XSTOCK_CATALOG.length,
    tokens: searchEquities(q, 36)
  });
}
