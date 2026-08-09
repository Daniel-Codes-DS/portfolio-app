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
    <div style={{ width: "100%", height: "400px", marginTop: "2rem", background: "var(--paper)", padding: "1.5rem", borderRadius: "8px", border: "1px solid var(--hairline)", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.02)" }}>
      <h3 style={{ textAlign: "center", marginBottom: "1rem", color: "var(--ink-soft)", textTransform: "uppercase", fontSize: "0.85rem", letterSpacing: "0.05em" }}>{t("portfolio.performanceTitle") || "Historical Performance vs Benchmarks"}</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={performanceHistory} margin={{ top: 5, right: 30, left: 0, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
          <XAxis 
            dataKey="date" 
            stroke="var(--ink-soft)" 
            tick={{ fill: "var(--ink-soft)", fontSize: 12 }} 
            tickFormatter={(tick) => {
              // Simplify date label to Month-Year
              const d = new Date(tick);
              return `${d.getMonth()+1}/${d.getFullYear()}`;
            }}
          />
          <YAxis 
            tickFormatter={formatPercent} 
            stroke="var(--ink-soft)" 
            tick={{ fill: "var(--ink-soft)", fontSize: 12 }} 
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" />
          <Line type="monotone" dataKey="Portfolio" name={t("portfolio.yourPortfolio") || "Your Portfolio"} stroke="var(--accent)" strokeWidth={3} dot={false} />
          <Line type="monotone" dataKey="S&P 500" stroke="#475569" strokeWidth={2} dot={false} strokeDasharray="5 5" />
          <Line type="monotone" dataKey="TA-125" stroke="#b45309" strokeWidth={2} dot={false} strokeDasharray="3 3" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
