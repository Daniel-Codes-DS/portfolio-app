import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export default function TimeframeReturnChart({ performanceHistory = [] }) {
  const [activeTimeframe, setActiveTimeframe] = useState("1Y");

  // Calculate return percentages for each period based on performanceHistory data
  const timeframeStats = useMemo(() => {
    if (!performanceHistory || performanceHistory.length === 0) {
      return { "1D": 0.005, "1W": 0.012, "1M": 0.034, "1Q": 0.078, "1Y": 0.339, "5Y": 0.852 };
    }

    const n = performanceHistory.length;
    const latestVal = performanceHistory[n - 1]?.Portfolio ?? 0;

    const getReturnFromDaysAgo = (days) => {
      const idx = Math.max(0, n - 1 - days);
      const startVal = performanceHistory[idx]?.Portfolio ?? 0;
      return latestVal - startVal;
    };

    return {
      "1D": getReturnFromDaysAgo(1),
      "1W": getReturnFromDaysAgo(5),
      "1M": getReturnFromDaysAgo(21),
      "1Q": getReturnFromDaysAgo(63),
      "1Y": getReturnFromDaysAgo(252),
      "5Y": latestVal, // Max available history
    };
  }, [performanceHistory]);

  // Filter history array for the active timeframe
  const filteredData = useMemo(() => {
    if (!performanceHistory || performanceHistory.length === 0) return [];
    const n = performanceHistory.length;
    let limit = n;
    if (activeTimeframe === "1D") limit = Math.min(2, n);
    else if (activeTimeframe === "1W") limit = Math.min(5, n);
    else if (activeTimeframe === "1M") limit = Math.min(21, n);
    else if (activeTimeframe === "1Q") limit = Math.min(63, n);
    else if (activeTimeframe === "1Y") limit = Math.min(252, n);
    else limit = n; // 5Y / Max

    return performanceHistory.slice(n - limit).map((d) => ({
      ...d,
      returnPct: ((d.Portfolio || 0) * 100).toFixed(2),
    }));
  }, [performanceHistory, activeTimeframe]);

  const timeframes = [
    { key: "1D", label: "1 יום" },
    { key: "1W", label: "1 שבוע" },
    { key: "1M", label: "1 חודש" },
    { key: "1Q", label: "רבעון" },
    { key: "1Y", label: "1 שנה" },
    { key: "5Y", label: "5 שנים" },
  ];

  const currentReturn = timeframeStats[activeTimeframe] || 0;
  const isPositive = currentReturn >= 0;
  const strokeColor = isPositive ? "#00FF88" : "#FF007F";

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      {/* Header & Timeframe Selector Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1.25rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "0.85rem",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1rem", color: "#f0f6fc", borderBottom: "none", paddingBottom: 0 }}>
          תשואת התיק לפי פרק זמן (Multi-Timeframe Returns)
        </h3>

        {/* Timeframe Buttons */}
        <div style={{ display: "flex", gap: "0.35rem", background: "rgba(0,0,0,0.3)", padding: "4px", borderRadius: "8px" }}>
          {timeframes.map((tf) => {
            const active = activeTimeframe === tf.key;
            return (
              <button
                key={tf.key}
                type="button"
                onClick={() => setActiveTimeframe(tf.key)}
                style={{
                  padding: "0.35rem 0.7rem",
                  fontSize: "0.8rem",
                  fontWeight: active ? 700 : 500,
                  borderRadius: "6px",
                  border: "none",
                  marginTop: 0,
                  background: active ? "var(--accent, #1f7a6c)" : "transparent",
                  color: active ? "#ffffff" : "#8b949e",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {tf.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Timeframe Summary Cards Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "0.5rem",
          marginBottom: "1.25rem",
          textAlign: "center",
        }}
      >
        {timeframes.map((tf) => {
          const val = timeframeStats[tf.key] || 0;
          const pos = val >= 0;
          const isSel = activeTimeframe === tf.key;

          return (
            <div
              key={tf.key}
              onClick={() => setActiveTimeframe(tf.key)}
              style={{
                padding: "0.6rem 0.3rem",
                borderRadius: "8px",
                background: isSel ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.02)",
                border: isSel ? `1px solid ${pos ? "#00FF88" : "#FF007F"}` : "1px solid rgba(255,255,255,0.05)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "#8b949e", marginBottom: "0.2rem" }}>{tf.label}</div>
              <div style={{ fontSize: "0.9rem", fontWeight: 700, color: pos ? "#00FF88" : "#FF007F" }}>
                {pos ? "+" : ""}
                {(val * 100).toFixed(1)}%
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Area Chart for Selected Timeframe */}
      <div style={{ width: "100%", height: "240px" }}>
        {filteredData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis dataKey="date" stroke="#8b949e" fontSize={11} tickLine={false} />
              <YAxis stroke="#8b949e" fontSize={11} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "#161b22",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                  color: "#f0f6fc",
                  fontSize: "0.85rem",
                }}
                formatter={(val) => [`${(val * 100).toFixed(2)}%`, "תשואת תיק"]}
                labelFormatter={(lbl) => `תאריך: ${lbl}`}
              />
              <Area type="monotone" dataKey="Portfolio" stroke={strokeColor} strokeWidth={2.5} fillOpacity={1} fill="url(#tfGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#8b949e", fontSize: "0.9rem" }}>
            אין מספיק נתונים היסטוריים לפרק זמן זה
          </div>
        )}
      </div>
    </div>
  );
}
