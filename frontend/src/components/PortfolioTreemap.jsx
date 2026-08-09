import React from "react";
import { Treemap, ResponsiveContainer, Tooltip } from "recharts";
import { useLang } from "../i18n/LangContext";

const COLORS = ["#1E3A8A", "#374151", "#B45309", "#047857", "#4338CA", "#0F766E", "#6D28D9"];

const CustomContent = (props) => {
  const { root, depth, x, y, width, height, index, name, value } = props;
  
  if (width < 20 || height < 20) return null; // Don't render text if box is too small

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: COLORS[index % COLORS.length],
          stroke: "rgba(30, 35, 45, 0.8)",
          strokeWidth: 2,
          strokeOpacity: 1,
        }}
      />
      <text
        x={x + width / 2}
        y={y + height / 2 + (height > 40 ? -6 : 0)}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={12}
        fillOpacity={0.9}
        style={{ pointerEvents: "none", fontFamily: "sans-serif", fontWeight: 500 }}
      >
        {name}
      </text>
      {height > 40 && (
        <text
          x={x + width / 2}
          y={y + height / 2 + 10}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#fff"
          fontSize={10}
          fillOpacity={0.7}
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
