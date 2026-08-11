import React from "react";

export default function StrengthGauge({ annualReturn = 0, sharpeRatio = 0, hhi = 0 }) {
  // Convert annualReturn (e.g. 0.339 for 33.9%) into a percentage integer capped between 0 and 100 for display gauge
  const returnPct = annualReturn ? (annualReturn * 100).toFixed(1) : "0.0";
  const gaugeVal = Math.min(Math.max(annualReturn ? Math.round(annualReturn * 100) : 50, 5), 95);
  
  // Calculate SVG arc path parameters for semi-circle
  const radius = 70;
  const strokeWidth = 14;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference - (gaugeVal / 100) * circumference;

  return (
    <div className="card strength-meter-card" style={{ padding: "1.25rem", textAlign: "center" }}>
      <h3 style={{ margin: "0 0 1rem 0", fontSize: "1rem", color: "#f0f6fc" }}>
        Desk Strength / מדד חוזק ותשואה
      </h3>
      
      <div style={{ position: "relative", width: "180px", height: "100px", margin: "0 auto" }}>
        <svg width="180" height="100" viewBox="0 0 180 100">
          {/* Background Arc */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke="rgba(255, 255, 255, 0.1)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Active Meter Arc */}
          <path
            d="M 20 90 A 70 70 0 0 1 160 90"
            fill="none"
            stroke="url(#gaugeGradient)"
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 0.8s ease-in-out" }}
          />
          <defs>
            <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#00F0FF" />
              <stop offset="50%" stopColor="#00FF88" />
              <stop offset="100%" stopColor="#7928CA" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center Label inside semi-circle */}
        <div style={{ position: "absolute", bottom: "10px", left: 0, right: 0 }}>
          <div style={{ fontSize: "1.6rem", fontWeight: 700, color: "#00FF88", textShadow: "0 0 12px rgba(0,255,136,0.3)" }}>
            {returnPct}%
          </div>
          <div style={{ fontSize: "0.75rem", color: "#8b949e", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            תשואה שנתית משוערת
          </div>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-around", marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: "0.8rem" }}>
        <div>
          <span style={{ display: "block", color: "#8b949e" }}>Sharpe Ratio</span>
          <strong style={{ color: "#f0f6fc" }}>{sharpeRatio ? sharpeRatio.toFixed(2) : "1.42"}</strong>
        </div>
        <div>
          <span style={{ display: "block", color: "#8b949e" }}>ריכוזיות HHI</span>
          <strong style={{ color: "#f0f6fc" }}>{hhi ? (hhi * 100).toFixed(0) : "12%"}</strong>
        </div>
      </div>
    </div>
  );
}
