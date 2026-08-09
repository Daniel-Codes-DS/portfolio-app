import React from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { useLang } from "../i18n/LangContext";

const COLORS = ["#1976D2", "#388E3C", "#FBC02D", "#F57C00", "#7B1FA2", "#D32F2F", "#00796B"];

const CustomContent = (props) => {
  const { root, depth, x, y, width, height, index, name, value } = props;
  
  if (width < 30 || height < 30) return null; // Don't render text if box is too small

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: COLORS[index % COLORS.length],
          stroke: "#2D3A50",
          strokeWidth: 2,
          strokeOpacity: 1,
        }}
      />
      <text
        x={x + 4}
        y={y + 18}
        fill="#fff"
        fontSize={12}
        fillOpacity={0.9}
        style={{ pointerEvents: "none", fontFamily: "sans-serif" }}
      >
        {name}
      </text>
      {height > 40 && (
        <text
          x={x + 4}
          y={y + 34}
          fill="#fff"
          fontSize={11}
          fillOpacity={0.6}
          style={{ pointerEvents: "none", fontFamily: "sans-serif" }}
        >
          {`(${value})`}
        </text>
      )}
    </g>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div style={{ background: "#2D3A50", padding: "10px", border: "1px solid #4D6486", color: "#fff", borderRadius: "4px" }}>
        <p style={{ margin: 0, fontWeight: "bold" }}>{data.name}</p>
        <p style={{ margin: 0 }}>Shares: {data.value}</p>
      </div>
    );
  }
  return null;
};

export default function PortfolioTreemap({ holdings }) {
  const { t } = useLang();

  if (!holdings || holdings.length === 0) return null;

  // Format data for Treemap
  const data = [
    {
      name: "Portfolio",
      children: holdings.map(h => ({
        name: h.ticker,
        value: h.quantity,
      }))
    }
  ];

  return (
    <div style={{ width: "100%", height: "350px", padding: "1rem" }}>
      <ResponsiveContainer width="100%" height="100%">
        <Treemap
          data={data}
          dataKey="value"
          stroke="#fff"
          fill="#8884d8"
          content={<CustomContent />}
        >
          <Tooltip content={<CustomTooltip />} />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
