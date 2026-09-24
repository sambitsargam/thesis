"use client";

/**
 * The product in one picture: a theme resolves to several equities, which a
 * single basket token holds. Drawn as inline SVG so it inherits theme colours
 * and needs no runtime.
 */
export default function HeroDiagram({tickers}: {tickers: string[]}) {
  const shown = tickers.slice(0, 4);
  const rows = shown.length || 3;
  const height = 168;
  const gap = height / (rows + 1);

  return (
    <svg
      className="hero-diagram"
      viewBox="0 0 420 168"
      role="img"
      aria-label="A theme resolves into equities held by one basket token"
    >
      <defs>
        <linearGradient id="flow" x1="0" x2="1">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.85" />
        </linearGradient>
      </defs>

      {/* the theme */}
      <g>
        <rect x="2" y="60" width="118" height="48" rx="11" className="dg-box" />
        <text x="61" y="80" textAnchor="middle" className="dg-label">
          your theme
        </text>
        <text x="61" y="96" textAnchor="middle" className="dg-sub">
          plain language
        </text>
      </g>

      {/* fan out to constituents */}
      {shown.map((ticker, i) => {
        const y = gap * (i + 1);
        return (
          <g key={ticker}>
            <path
              d={`M120 84 C 168 84, 168 ${y}, 214 ${y}`}
              className="dg-wire"
              style={{animationDelay: `${i * 0.18}s`}}
            />
            <rect x="214" y={y - 13} width="84" height="26" rx="8" className="dg-chip" />
            <text x="256" y={y + 4} textAnchor="middle" className="dg-ticker">
              {ticker}
            </text>
            <path
              d={`M298 ${y} C 336 ${y}, 336 84, 372 84`}
              className="dg-wire in"
              style={{animationDelay: `${0.5 + i * 0.18}s`}}
            />
          </g>
        );
      })}

      {/* the basket */}
      <g>
        <circle cx="386" cy="84" r="30" className="dg-basket" />
        <circle cx="386" cy="84" r="30" className="dg-basket-ring" />
        <text x="386" y="80" textAnchor="middle" className="dg-label">
          one
        </text>
        <text x="386" y="94" textAnchor="middle" className="dg-label">
          token
        </text>
      </g>
    </svg>
  );
}
