import React from "react";

// Curated respectable palette matching pie chart legend
const COLOR_PALETTE = [
  "#7928CA", // Purple
  "#FF007F", // Neon Pink
  "#00F0FF", // Cyan
  "#00FF88", // Mint Green
  "#FF9900", // Orange
  "#3B82F6", // Royal Blue
  "#10B981", // Emerald
  "#EC4899", // Magenta
  "#8B5CF6", // Violet
  "#F59E0B", // Amber
];

export default function AssetProgressBars({ currentHoldings = [] }) {
  if (!currentHoldings || currentHoldings.length === 0) return null;

  // Sort by weight descending
  const sorted = [...currentHoldings].sort((a, b) => b.weight - a.weight);

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "#f0f6fc" }}>
        התפלגות נכסים (Asset Exposure)
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {sorted.map((item, idx) => {
          const pct = (item.weight * 100).toFixed(1);
          const color = COLOR_PALETTE[idx % COLOR_PALETTE.length];

          return (
            <div key={item.ticker || idx} style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "#c9d1d9" }}>
                <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: color, display: "inline-block" }}></span>
                  {item.ticker}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 500, color: color }}>
                  {pct}%
                </span>
              </div>

              {/* Progress bar container */}
              <div
                style={{
                  width: "100%",
                  height: "7px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  borderRadius: "4px",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${pct}%`,
                    height: "100%",
                    backgroundColor: color,
                    borderRadius: "4px",
                    boxShadow: `0 0 8px ${color}80`,
                    transition: "width 0.6s ease-in-out",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
