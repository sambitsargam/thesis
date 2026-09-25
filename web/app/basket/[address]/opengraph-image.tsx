import {ImageResponse} from "next/og";
import {formatUnits} from "viem";
import {erc20Abi, thesisBasketAbi} from "@thesis/shared";
import {publicClient} from "../../chain";

export const runtime = "nodejs";
export const revalidate = 60;
export const alt = "A Thesis basket of tokenized equities on X Layer";
export const size = {width: 1200, height: 630};
export const contentType = "image/png";

/**
 * Live social card for a basket.
 *
 * Generated per request from chain state, so a link shared anywhere unfurls with
 * the basket's real holdings and share count rather than a static logo. This is
 * the growth loop: a creator shares a theme, and the preview sells it for them.
 */
export default async function Image({params}: {params: Promise<{address: string}>}) {
  const {address} = await params;
  const basket = address as `0x${string}`;

  let name = "Thesis basket";
  let theme = "";
  let symbol = "";
  let supply = "0";
  let tickers: string[] = [];

  try {
    const [n, s, t, constituents, total] = await Promise.all([
      publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "name"}),
      publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "symbol"}),
      publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "theme"}),
      publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "constituents"}),
      publicClient.readContract({address: basket, abi: thesisBasketAbi, functionName: "totalSupply"})
    ]);
    name = n;
    symbol = s;
    theme = t;
    supply = formatUnits(total, 18);
    tickers = await Promise.all(
      constituents.slice(0, 6).map((token) =>
        publicClient
          .readContract({address: token, abi: erc20Abi, functionName: "symbol"})
          .catch(() => "?")
      )
    );
  } catch {
    // A card that renders without chain data beats a broken preview.
  }

  const weight = tickers.length > 0 ? (100 / tickers.length).toFixed(2) : "—";
  const shares = Number(supply);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          background: "linear-gradient(135deg, #08090b 0%, #0f1a15 60%, #08090b 100%)",
          color: "#eceef1",
          fontFamily: "sans-serif"
        }}
      >
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <div style={{display: "flex", alignItems: "center", gap: 14}}>
            <div style={{width: 20, height: 20, borderRadius: 6, background: "#34d399"}} />
            <div style={{fontSize: 30, fontWeight: 700, letterSpacing: -1}}>Thesis</div>
          </div>
          <div
            style={{
              fontSize: 21,
              color: "#34d399",
              border: "1px solid #1f7d5c",
              borderRadius: 999,
              padding: "9px 22px"
            }}
          >
            Live on X Layer · 196
          </div>
        </div>

        <div style={{display: "flex", flexDirection: "column"}}>
          <div style={{fontSize: 62, fontWeight: 700, letterSpacing: -2.5, lineHeight: 1.1}}>
            {name.slice(0, 44)}
          </div>
          {theme && (
            <div style={{fontSize: 27, color: "#a2a8b4", marginTop: 16}}>
              {`\u201c${theme.slice(0, 82)}\u201d`}
            </div>
          )}
          <div style={{display: "flex", gap: 12, marginTop: 34, flexWrap: "wrap"}}>
            {tickers.map((ticker) => (
              <div
                key={ticker}
                style={{
                  fontSize: 25,
                  color: "#34d399",
                  border: "1px solid #1f7d5c",
                  borderRadius: 11,
                  padding: "10px 20px"
                }}
              >
                {ticker}
              </div>
            ))}
          </div>
        </div>

        <div style={{display: "flex", justifyContent: "space-between", alignItems: "flex-end"}}>
          <div style={{display: "flex", gap: 56}}>
            <div style={{display: "flex", flexDirection: "column"}}>
              <div style={{fontSize: 17, color: "#6e7480", letterSpacing: 1.6}}>SYMBOL</div>
              <div style={{fontSize: 32, fontWeight: 650, marginTop: 6}}>{symbol || "—"}</div>
            </div>
            <div style={{display: "flex", flexDirection: "column"}}>
              <div style={{fontSize: 17, color: "#6e7480", letterSpacing: 1.6}}>EACH WEIGHTED</div>
              <div style={{fontSize: 32, fontWeight: 650, marginTop: 6}}>{`${weight}%`}</div>
            </div>
            <div style={{display: "flex", flexDirection: "column"}}>
              <div style={{fontSize: 17, color: "#6e7480", letterSpacing: 1.6}}>SHARES OUT</div>
              <div style={{fontSize: 32, fontWeight: 650, marginTop: 6}}>
                {shares === 0 ? "0" : shares.toFixed(3)}
              </div>
            </div>
          </div>
          <div style={{fontSize: 21, color: "#6e7480"}}>Fully backed · redeemable in kind</div>
        </div>
      </div>
    ),
    size
  );
}
