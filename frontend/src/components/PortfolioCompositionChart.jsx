import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useLang } from "../i18n/LangContext";

const COLORS = [
  "#2abda8", "#1f7a6c", "#5b6b67", "#8c9b98", "#b4432e", 
  "#e57373", "#ffb74d", "#ffd54f", "#81c784", "#4dd0e1"
];

export default function PortfolioCompositionChart({ currentHoldings, targetWeights }) {
  const { t } = useLang();

  // Format current holdings for the pie chart
  const currentData = (currentHoldings || []).map((h, i) => ({
    name: h.ticker,
    value: (h.weight || 0) * 100, // Convert to percentage
    color: COLORS[i % COLORS.length]
  })).sort((a, b) => b.value - a.value);

  // Format target weights for the pie chart
  const targetData = Object.entries(targetWeights || {}).map(([ticker, weight], i) => ({
    name: ticker,
    value: (weight || 0) * 100,
    color: COLORS[i % COLORS.length]
  })).sort((a, b) => b.value - a.value);

  const CustomTooltip = ({ active, payload }) => {
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
          <p style={{ margin: 0, fontWeight: "bold" }}>{payload[0].name}</p>
          <p style={{ margin: 0 }}>{payload[0].value.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", justifyContent: "space-around", marginTop: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "400px", height: "300px" }}>
        <h4 style={{ textAlign: "center", marginBottom: "0.5rem" }}>{t("portfolio.currentComposition") || "Current Composition"}</h4>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={currentData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {currentData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ width: "100%", maxWidth: "400px", height: "300px" }}>
        <h4 style={{ textAlign: "center", marginBottom: "0.5rem" }}>{t("portfolio.targetComposition") || "Target Composition"}</h4>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={targetData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              stroke="var(--surface)"
              strokeWidth={2}
            >
              {targetData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
