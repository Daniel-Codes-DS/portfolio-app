import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useLang } from "../i18n/LangContext";

export default function PerformanceChart({ performanceHistory }) {
  const { t } = useLang();

  if (!performanceHistory || performanceHistory.length === 0) {
    return null;
  }

  // Format ticks to show percentage
  const formatPercent = (tick) => `${(tick * 100).toFixed(0)}%`;

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border)",
          padding: "10px",
          borderRadius: "8px",
          color: "var(--ink)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
        }}>
          <p style={{ margin: 0, fontWeight: "bold", marginBottom: "5px" }}>{label}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ margin: 0, color: entry.color }}>
              {entry.name}: {(entry.value * 100).toFixed(2)}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card" style={{ width: "100%", height: "100%", minHeight: "400px", display: "flex", flexDirection: "column" }}>
      <h3 style={{ margin: 0, padding: "1rem" }}>{t("portfolio.performanceTitle") || "Historical Performance vs Benchmarks"}</h3>
      <div style={{ flex: 1, minHeight: 0 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={performanceHistory} margin={{ top: 5, right: 30, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="#A0B2C6" 
              tick={{ fill: "#A0B2C6", fontSize: 12 }} 
              tickFormatter={(tick) => {
                const d = new Date(tick);
                return `${d.getMonth()+1}/${d.getFullYear()}`;
              }}
            />
            <YAxis 
              stroke="#A0B2C6" 
              tick={{ fill: "#A0B2C6", fontSize: 12 }} 
              tickFormatter={(tick) => `$${tick.toLocaleString()}`} 
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: "0.85rem", paddingTop: "10px", color: "#8b949e" }} iconType="circle" />
            <Line type="monotone" dataKey="portfolio_value" name={t("portfolio.yourPortfolio") || "Portfolio Value"} stroke="#00F0FF" strokeWidth={3} dot={false} activeDot={{ r: 8, fill: "#00F0FF", stroke: "#fff", strokeWidth: 2 }} />
            <Line type="monotone" dataKey="benchmark_value" name="Benchmark (S&P 500)" stroke="#00FF88" strokeWidth={3} dot={false} strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
