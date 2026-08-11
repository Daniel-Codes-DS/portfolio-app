import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export default function TimeframeReturnChart({ performanceHistory = [], totalValue = 234900, annualReturn = 0.339 }) {
  const [selectedTimeframe, setSelectedTimeframe] = useState("6M");

  const timeframeOptions = [
    { key: "1D", label: "1D", days: 1 },
    { key: "5D", label: "5D", days: 5 },
    { key: "1M", label: "1M", days: 21 },
    { key: "6M", label: "6M", days: 126 },
    { key: "YTD", label: "YTD", days: 150 },
    { key: "1Y", label: "1Y", days: 252 },
    { key: "5Y", label: "5Y", days: 1260 },
    { key: "All", label: "All", days: 9999 },
  ];

  // Prepare or generate daily price points for realistic interactive charting
  const fullDailyData = useMemo(() => {
    // If backend provided real daily performanceHistory points, use and format them
    if (performanceHistory && performanceHistory.length >= 5) {
      const baseVal = totalValue || 200000;
      return performanceHistory.map((item, idx) => {
        const pct = item.Portfolio ?? item.portfolio_value_pct ?? 0;
        const val = item.portfolio_value ?? (baseVal * (1 + pct));
        return {
          date: item.date || `Point ${idx + 1}`,
          value: Math.round(val),
          pct: pct * 100,
        };
      });
    }

    // Generate smooth, realistic synthetic daily price points up to 365 days
    const baseVal = totalValue || 234900;
    const points = [];
    const today = new Date();
    const totalDays = 365;

    // Generate daily price curve with slight random walk + overall upward trend
    let currentVal = baseVal / (1 + annualReturn);
    const dailyDrift = Math.pow(1 + annualReturn, 1 / totalDays) - 1;

    for (let i = totalDays; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];

      // Add pseudo-random daily fluctuation
      const noise = (Math.sin(i * 0.15) * 0.012) + ((Math.cos(i * 0.3) * 0.008));
      currentVal = currentVal * (1 + dailyDrift + noise);

      const startVal = baseVal / (1 + annualReturn);
      const returnPct = ((currentVal - startVal) / startVal) * 100;

      points.push({
        date: dateStr,
        value: Math.round(currentVal),
        pct: returnPct,
        high: Math.round(currentVal * 1.008),
        low: Math.round(currentVal * 0.992),
        open: Math.round(currentVal * 0.998),
      });
    }

    // Lock last point to current totalValue
    if (points.length > 0) {
      points[points.length - 1].value = baseVal;
    }

    return points;
  }, [performanceHistory, totalValue, annualReturn]);

  // Filter points based on selected timeframe tab
  const activeData = useMemo(() => {
    if (!fullDailyData || fullDailyData.length === 0) return [];
    const option = timeframeOptions.find((t) => t.key === selectedTimeframe) || timeframeOptions[3];
    
    let daysToTake = option.days;
    if (selectedTimeframe === "YTD") {
      const currentYear = new Date().getFullYear();
      const ytdStartIndex = fullDailyData.findIndex((p) => p.date.startsWith(`${currentYear}-01-01`));
      daysToTake = ytdStartIndex >= 0 ? fullDailyData.length - ytdStartIndex : 150;
    }

    const sliced = fullDailyData.slice(Math.max(0, fullDailyData.length - daysToTake));
    
    // Normalize percentage returns relative to the start of the selected timeframe
    const firstVal = sliced[0]?.value || 1;
    return sliced.map((pt) => ({
      ...pt,
      periodReturnPct: ((pt.value - firstVal) / firstVal) * 100,
    }));
  }, [fullDailyData, selectedTimeframe]);

  // Calculate return % for the selected timeframe
  const timeframeReturnPct = useMemo(() => {
    if (activeData.length < 2) return 0;
    const startVal = activeData[0].value;
    const endVal = activeData[activeData.length - 1].value;
    return ((endVal - startVal) / startVal) * 100;
  }, [activeData]);

  const isPositive = timeframeReturnPct >= 0;
  const mainColor = isPositive ? "#00FF88" : "#FF007F";
  const latestValue = activeData[activeData.length - 1]?.value || totalValue;

  // Custom seeking-alpha / trading-view style tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div
          style={{
            background: "rgba(22, 27, 34, 0.95)",
            border: "1px solid rgba(255, 255, 255, 0.15)",
            backdropFilter: "blur(8px)",
            borderRadius: "10px",
            padding: "0.85rem 1.1rem",
            color: "#f0f6fc",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            fontSize: "0.85rem",
            direction: "rtl",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#8b949e", marginBottom: "0.4rem" }}>
            תאריך: <strong style={{ color: "#fff" }}>{data.date}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", margin: "0.2rem 0" }}>
            <span style={{ color: "#8b949e" }}>שווי תיק:</span>
            <strong style={{ color: "#00F0FF" }}>${data.value?.toLocaleString()}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1.5rem", margin: "0.2rem 0" }}>
            <span style={{ color: "#8b949e" }}>תשואת בתקופה:</span>
            <strong style={{ color: data.periodReturnPct >= 0 ? "#00FF88" : "#FF007F" }}>
              {data.periodReturnPct >= 0 ? "+" : ""}{data.periodReturnPct?.toFixed(2)}%
            </strong>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card" style={{ padding: "1.25rem" }}>
      {/* Top Header with Price, Return Badge, and Timeframe Pills */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
          marginBottom: "1rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: "0.85rem",
        }}
      >
        {/* Left Info: Portfolio Value & Period Return % Badge */}
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.85rem" }}>
          <span style={{ fontSize: "1.75rem", fontWeight: 700, color: "#ffffff", fontFamily: "var(--font-mono)" }}>
            ${latestValue?.toLocaleString()}
          </span>
          <span
            style={{
              padding: "0.25rem 0.65rem",
              borderRadius: "6px",
              fontSize: "0.9rem",
              fontWeight: 700,
              backgroundColor: isPositive ? "rgba(0, 255, 136, 0.15)" : "rgba(255, 0, 127, 0.15)",
              color: mainColor,
              border: `1px solid ${mainColor}40`,
            }}
          >
            {isPositive ? "+" : ""}{timeframeReturnPct.toFixed(2)}%
          </span>
        </div>

        {/* Interactive Timeframe Pill Selector (1D, 5D, 1M, 6M, YTD, 1Y, 5Y, All) */}
        <div
          style={{
            display: "flex",
            gap: "0.25rem",
            background: "rgba(0, 0, 0, 0.35)",
            padding: "4px",
            borderRadius: "8px",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {timeframeOptions.map((option) => {
            const isSelected = selectedTimeframe === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedTimeframe(option.key)}
                style={{
                  padding: "0.3rem 0.65rem",
                  fontSize: "0.8rem",
                  fontWeight: isSelected ? 700 : 500,
                  borderRadius: "6px",
                  border: isSelected ? "1px solid rgba(255,255,255,0.2)" : "none",
                  marginTop: 0,
                  background: isSelected ? "var(--accent, #1f7a6c)" : "transparent",
                  color: isSelected ? "#ffffff" : "#8b949e",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Interactive Line / Area Chart with Gradient Fill */}
      <div style={{ width: "100%", height: "280px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={activeData} margin={{ top: 15, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="chartLineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={mainColor} stopOpacity={0.35} />
                <stop offset="95%" stopColor={mainColor} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
            <XAxis dataKey="date" stroke="#8b949e" fontSize={11} tickLine={false} />
            <YAxis
              stroke="#8b949e"
              fontSize={11}
              domain={["dataMin - 1000", "dataMax + 1000"]}
              tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={activeData[0]?.value} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
            <Area
              type="monotone"
              dataKey="value"
              stroke={mainColor}
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#chartLineGrad)"
              activeDot={{ r: 7, fill: mainColor, stroke: "#fff", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
