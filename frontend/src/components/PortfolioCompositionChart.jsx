import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useLang } from "../i18n/LangContext";

const COLORS = [
  "#1e3a8a", // Deep Navy
  "#0f766e", // Teal / Emerald
  "#b45309", // Bronze
  "#475569", // Slate Gray
  "#4338ca", // Indigo
  "#0369a1", // Ocean Blue
  "#b91c1c", // Deep Red
  "#047857", // Forest Green
  "#6d28d9", // Purple
  "#334155"  // Dark Slate
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

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
    if (percent < 0.05) return null; // Don't show label for tiny slices (< 5%)
    
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
        {name}
      </text>
    );
  };

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", justifyContent: "space-around", marginTop: "1rem" }}>
      <div style={{ width: "100%", maxWidth: "450px", height: "350px" }}>
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
              label={renderCustomizedLabel}
              labelLine={false}
            >
              {currentData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div style={{ width: "100%", maxWidth: "450px", height: "350px" }}>
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
              label={renderCustomizedLabel}
              labelLine={false}
            >
              {targetData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
