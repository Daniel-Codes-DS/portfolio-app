import React from "react";
import { useLang } from "../i18n/LangContext";

export default function RebalancingSimulator({ currentHoldings, targetWeights, totalValue }) {
  const { t, locale } = useLang();

  if (!currentHoldings || !targetWeights || totalValue == null || totalValue === 0) {
    return null;
  }

  // Calculate required trades
  const trades = [];
  
  // Create a map of current holdings by ticker
  const currentMap = {};
  currentHoldings.forEach(h => {
    currentMap[h.ticker] = h;
  });

  // Combine tickers from both current holdings and target weights
  const allTickers = new Set([
    ...currentHoldings.map(h => h.ticker),
    ...Object.keys(targetWeights)
  ]);

  allTickers.forEach(ticker => {
    const currentVal = currentMap[ticker] ? currentMap[ticker].current_value : 0;
    const currentQty = currentMap[ticker] ? currentMap[ticker].quantity : 0;
    const currentPrice = currentQty > 0 ? currentVal / currentQty : 0; // rough est
    
    const targetWeight = targetWeights[ticker] || 0;
    const targetVal = totalValue * targetWeight;
    const diff = targetVal - currentVal;

    // Ignore tiny rounding differences (less than $10)
    if (Math.abs(diff) > 10) {
      trades.push({
        ticker,
        currentVal,
        targetVal,
        diff,
        action: diff > 0 ? "BUY" : "SELL",
        // Approximate shares to trade if we have a current price
        sharesDiff: currentPrice > 0 ? diff / currentPrice : null
      });
    }
  });

  // Sort trades: Sells first (to free up cash), then Buys
  trades.sort((a, b) => a.diff - b.diff);

  if (trades.length === 0) {
    return (
      <div className="card dashboard-full-width">
        <h2>{t("portfolio.rebalancingTitle") || "Rebalancing Simulator"}</h2>
        <p className="empty-state">{t("portfolio.rebalancingEmpty") || "Your portfolio is perfectly balanced according to the target weights!"}</p>
      </div>
    );
  }

  return (
    <div className="card dashboard-full-width">
      <h2>{t("portfolio.rebalancingTitle") || "Rebalancing Simulator"}</h2>
      <p style={{ color: "var(--ink-soft)", fontSize: "0.9rem", marginBottom: "1rem" }}>
        {t("portfolio.rebalancingDesc") || "Suggested trades to reach the AI-recommended target weights based on your current portfolio value."}
      </p>
      
      <div style={{ overflowX: "auto" }}>
        <table className="holdings-table">
          <thead>
            <tr>
              <th>{t("portfolio.colAction") || "Action"}</th>
              <th>{t("portfolio.colTicker")}</th>
              <th>{t("portfolio.currentValue") || "Current Value"}</th>
              <th>{t("portfolio.targetValue") || "Target Value"}</th>
              <th>{t("portfolio.tradeAmount") || "Trade Amount"}</th>
              <th>{t("portfolio.estShares") || "Est. Shares"}</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((trade, i) => (
              <tr key={i}>
                <td style={{ 
                  color: trade.action === "BUY" ? "var(--accent)" : "var(--danger)",
                  fontWeight: 700 
                }}>
                  {trade.action}
                </td>
                <td style={{ fontWeight: 600 }}>{trade.ticker}</td>
                <td>{trade.currentVal.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td>{trade.targetVal.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td style={{ color: trade.action === "BUY" ? "var(--accent)" : "var(--danger)", fontWeight: 500 }}>
                  {trade.diff > 0 ? "+" : ""}{trade.diff.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td>
                  {trade.sharesDiff != null 
                    ? `${trade.sharesDiff > 0 ? "+" : ""}${trade.sharesDiff.toFixed(2)}` 
                    : "N/A"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
