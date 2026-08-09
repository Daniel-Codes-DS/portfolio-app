import React from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useLang } from "../i18n/LangContext";

const COLORS = [
  "#00F0FF", "#00FF88", "#B026FF", "#FF007F", "#FFEA00", "#FF4C4C", "#00D2FF"
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
          backgroundColor: "#2D3A50",
          border: "1px solid #4D6486",
          padding: "10px",
          borderRadius: "4px",
          color: "#fff"
        }}>
          <p style={{ margin: 0, fontWeight: "bold" }}>{payload[0].name}</p>
          <p style={{ margin: 0 }}>{payload[0].value.toFixed(1)}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: "400px", padding: 0 }}>
      <h3 style={{ margin: 0, padding: "1rem" }}>{t("portfolio.currentComposition") || "Country Exposure"}</h3>
      <div style={{ flex: 1, minHeight: 0, padding: "0 1.5rem 1.5rem" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={currentData}
              cx="50%"
              cy="50%"
              innerRadius={0}
              outerRadius={80}
              dataKey="value"
              stroke="rgba(30,35,45,0.8)"
              strokeWidth={3}
            >
              {currentData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: "0.85rem", paddingTop: "10px", color: "#FFF" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
