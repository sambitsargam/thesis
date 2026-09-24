"use client";

import {useEffect, useState} from "react";

export interface Slice {
  ticker: string;
  value: number;
  target: number;
}

const COLORS = ["#34d399", "#38bdf8", "#a78bfa", "#fbbf24", "#fb7185", "#2dd4bf", "#f472b6", "#94a3b8"];

/**
 * Allocation donut, drawn from realised USD value rather than target weight.
 *
 * Showing actual against target is the point: an equal-weight basket drifts as
 * its constituents move, and the gap is exactly what a rebalance closes.
 */
export default function Allocation({slices, size = 168}: {slices: Slice[]; size?: number}) {
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDrawn(true), 80);
    return () => clearTimeout(timer);
  }, []);

  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total <= 0) return null;

  const radius = size / 2 - 14;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const arcs = slices.map((slice, i) => {
    const fraction = slice.value / total;
    const arc = {
      ticker: slice.ticker,
      color: COLORS[i % COLORS.length]!,
      dash: fraction * circumference,
      offset: offset * circumference,
      percent: fraction * 100,
      target: slice.target,
      value: slice.value
    };
    offset += fraction;
    return arc;
  });

  return (
    <div className="alloc">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label="Allocation by value"
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {arcs.map((arc) => (
            <circle
              key={arc.ticker}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={arc.color}
              strokeWidth={13}
              strokeLinecap="butt"
              strokeDasharray={`${drawn ? arc.dash : 0} ${circumference}`}
              strokeDashoffset={-arc.offset}
              style={{transition: "stroke-dasharray 1.1s cubic-bezier(0.16, 1, 0.3, 1)"}}
            />
          ))}
        </g>
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          className="alloc-total"
          fill="currentColor"
        >
          ${total < 1 ? total.toFixed(4) : total.toFixed(2)}
        </text>
        <text x="50%" y="60%" textAnchor="middle" className="alloc-sub" fill="currentColor">
          held
        </text>
      </svg>

      <ul className="alloc-legend">
        {arcs.map((arc) => {
          const drift = arc.percent - arc.target;
          return (
            <li key={arc.ticker}>
              <span className="swatch" style={{background: arc.color}} />
              <span className="alloc-ticker">{arc.ticker}</span>
              <span className="alloc-pct tnum">{arc.percent.toFixed(2)}%</span>
              <span
                className={`alloc-drift tnum ${Math.abs(drift) < 0.01 ? "flat" : drift > 0 ? "over" : "under"}`}
              >
                {drift > 0 ? "+" : ""}
                {drift.toFixed(2)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
