import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export default function TimeframeReturnChart({ performanceHistory = [] }) {
  // Calculate return percentages for each period based on performanceHistory data
  const timeframeData = useMemo(() => {
    if (!performanceHistory || performanceHistory.length === 0) {
      return [
        { name: "1 יום", timeframe: "1D", returnVal: 0.5 },
        { name: "1 שבוע", timeframe: "1W", returnVal: 1.2 },
        { name: "1 חודש", timeframe: "1M", returnVal: 3.4 },
        { name: "רבעון", timeframe: "1Q", returnVal: 7.8 },
        { name: "1 שנה", timeframe: "1Y", returnVal: 33.9 },
        { name: "5 שנים", timeframe: "5Y", returnVal: 85.2 },
      ];
    }

    const n = performanceHistory.length;
    const latestVal = performanceHistory[n - 1]?.Portfolio ?? 0;

    const getReturnFromDaysAgo = (days) => {
      const idx = Math.max(0, n - 1 - days);
      const startVal = performanceHistory[idx]?.Portfolio ?? 0;
      return (latestVal - startVal) * 100;
    };

    return [
      { name: "1 יום", timeframe: "1D", returnVal: getReturnFromDaysAgo(1) },
      { name: "1 שבוע", timeframe: "1W", returnVal: getReturnFromDaysAgo(5) },
      { name: "1 חודש", timeframe: "1M", returnVal: getReturnFromDaysAgo(21) },
      { name: "רבעון", timeframe: "1Q", returnVal: getReturnFromDaysAgo(63) },
      { name: "1 שנה", timeframe: "1Y", returnVal: getReturnFromDaysAgo(252) },
      { name: "5 שנים", timeframe: "5Y", returnVal: latestVal * 100 },
    ];
  }, [performanceHistory]);

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      {/* Section Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "0.85rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#f0f6fc", borderBottom: "none", paddingBottom: 0 }}>
          תשואת התיק המנותח לפי פרקי זמן (1D, 1W, 1M, 1Q, 1Y, 5Y)
        </h3>
        <span style={{ fontSize: "0.8rem", color: "#8b949e" }}>השוואת תשואה תקופתית באחוזים</span>
      </div>

      {/* Bar Chart showing 6 timeframes side-by-side */}
      <div style={{ width: "100%", height: "260px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={timeframeData} margin={{ top: 20, right: 10, left: -10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
            <XAxis dataKey="name" stroke="#8b949e" fontSize={12} tickLine={false} />
            <YAxis stroke="#8b949e" fontSize={11} tickFormatter={(v) => `${v.toFixed(0)}%`} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "#161b22",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                color: "#f0f6fc",
                fontSize: "0.85rem",
              }}
              formatter={(val) => [`${val.toFixed(2)}%`, "תשואה תקופתית"]}
              labelFormatter={(lbl) => `פרק זמן: ${lbl}`}
            />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
            <Bar dataKey="returnVal" radius={[6, 6, 0, 0]}>
              {timeframeData.map((entry, index) => {
                const isPos = entry.returnVal >= 0;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={isPos ? "#00FF88" : "#FF007F"}
                    style={{
                      filter: `drop-shadow(0px 0px 6px ${isPos ? "#00FF88" : "#FF007F"}60)`,
                    }}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Chips under Bar Chart */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "0.5rem",
          marginTop: "1rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          textAlign: "center",
        }}
      >
        {timeframeData.map((item) => {
          const isPos = item.returnVal >= 0;
          return (
            <div key={item.timeframe} style={{ background: "rgba(255,255,255,0.02)", padding: "0.4rem 0.2rem", borderRadius: "6px" }}>
              <div style={{ fontSize: "0.7rem", color: "#8b949e" }}>{item.name}</div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: isPos ? "#00FF88" : "#FF007F" }}>
                {isPos ? "+" : ""}
                {item.returnVal.toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
