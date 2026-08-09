import { useEffect, useState } from "react";
import { api } from "../api";
import { useLang } from "../i18n/LangContext";
import DisclaimerBanner from "../components/DisclaimerBanner";
import PortfolioCompositionChart from "../components/PortfolioCompositionChart";
import PerformanceChart from "../components/PerformanceChart";
import PortfolioTreemap from "../components/PortfolioTreemap";
import RebalancingSimulator from "../components/RebalancingSimulator";

export default function PortfolioDetail({ token, portfolioId, onBack }) {
  const { t, locale } = useLang();
  const [portfolio, setPortfolio]         = useState(null);
  const [history, setHistory]             = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading]             = useState(true);
  const [uploading, setUploading]         = useState(false);
  const [analyzing, setAnalyzing]         = useState(false);
  const [error, setError]                 = useState("");

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [portfolioId]);

  async function load() {
    setLoading(true); setError("");
    try {
      const [p, h] = await Promise.all([
        api.getPortfolio(token, portfolioId),
        api.getHistory(token, portfolioId),
      ]);
      setPortfolio(p); setHistory(h);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true); setError("");
    try { await api.uploadFile(token, portfolioId, file); await load(); }
    catch (e) { setError(e.message); }
    finally { setUploading(false); e.target.value = ""; }
  }

  async function handleRunAnalysis() {
    setAnalyzing(true); setError(""); setAnalysisResult(null);
    try { const result = await api.runAnalysis(token, portfolioId); setAnalysisResult(result); await load(); }
    catch (e) { setError(e.message); }
    finally { setAnalyzing(false); }
  }

  async function handleDownloadPdf(analysisId) {
    setError("");
    try {
      const { url } = await api.getPdfUrl(token, portfolioId, analysisId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) { setError(e.message); }
  }

  if (loading) return <div className="center-screen">{t("loading")}</div>;

  const holdingsCount = portfolio?.holdings?.length || 0;

  return (
    <div className={analysisResult ? "premium-dashboard page-wide" : "page-wide force-white-bg"}>
      <header className="topbar">
        <button className="link-button" onClick={onBack}>
          &larr; {t("portfolio.back")}</button>
        <h1>{portfolio?.name}</h1>
      </header>

      {error && <p className="error">{error}</p>}

      {/* Holdings */}
      <section className="card">
        <h2>{t("portfolio.holdingsTitle")(holdingsCount)}</h2>

        {holdingsCount > 0 ? (
          <table className="holdings-table">
            <thead>
              <tr>
                <th>{t("portfolio.colTicker")}</th>
                <th>{t("portfolio.colQty")}</th>
                <th>{t("portfolio.colPrice")}</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.holdings.map((h) => (
                <tr key={h.id}>
                  <td>{h.ticker}</td>
                  <td>{h.quantity}</td>
                  <td>{h.avg_price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-state">{t("portfolio.holdingsEmpty")}</p>
        )}

        <label className="upload-button">
          {uploading ? t("portfolio.uploading") : t("portfolio.uploadBtn")}
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg"
            onChange={handleFileUpload}
            disabled={uploading}
            hidden
          />
        </label>
      </section>

      {/* Analysis */}
      <DisclaimerBanner />
      <section className="card">
        <h2>{t("portfolio.analysisTitle")}</h2>
        <button onClick={handleRunAnalysis} disabled={analyzing || holdingsCount === 0}>
          {analyzing ? t("portfolio.running") : t("portfolio.runBtn")}
        </button>

        {analysisResult && (
          <div className="analysis-result">
            {/* ── Dashboard Grid: Top Row ── */}
            <div className="dashboard-grid top-row">
              {/* Left Column: KPIs */}
              <div className="kpi-column" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <h3 style={{ margin: 0, paddingBottom: "1rem" }}>Portfolio Activity Summary</h3>
                </div>
                
                <div className="metric">
                  <span className="metric-label">{t("portfolio.portfolioValue")}</span>
                  <span className="metric-value">
                    ${analysisResult.total_value?.toLocaleString(locale, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                
                <div className="metric">
                  <span className="metric-label">{t("portfolio.dividendYield") || "Yield Cost Ratio"}</span>
                  <span className="metric-value" style={{ color: "#00FF88", background: "none", WebkitTextFillColor: "#00FF88" }}>
                    {analysisResult.portfolio_dividend_yield != null 
                      ? `${(analysisResult.portfolio_dividend_yield * 100).toFixed(2)}%` 
                      : "-"}
                  </span>
                </div>
                
                <div className="metric">
                  <span className="metric-label">{t("portfolio.annReturn") || "Annual Return"}</span>
                  <span className="metric-value" style={{ color: analysisResult.annual_return > 0 ? "#00FF88" : "#FF007F", background: "none", WebkitTextFillColor: analysisResult.annual_return > 0 ? "#00FF88" : "#FF007F" }}>
                    {analysisResult.annual_return != null
                      ? `${(analysisResult.annual_return * 100).toFixed(1)}%`
                      : "-"}
                  </span>
                </div>
                
                <div className="metric">
                  <span className="metric-label">{t("portfolio.expenseRatio") || "Expense Ratio"}</span>
                  <span className="metric-value" style={{ color: "#00F0FF", background: "none", WebkitTextFillColor: "#00F0FF" }}>
                    {analysisResult.portfolio_expense_ratio != null 
                      ? `${(analysisResult.portfolio_expense_ratio * 100).toFixed(2)}%` 
                      : "-"}
                  </span>
                </div>
              </div>

              {/* Middle Column: Performance / Bar Chart */}
              <PerformanceChart performanceHistory={analysisResult.performance_history || []} />

              {/* Right Column: Pie Chart (Country Exposure / Target) */}
              <PortfolioCompositionChart 
                currentHoldings={analysisResult.current_holdings || []}
                targetWeights={analysisResult.target_weights || {}}
              />
            </div>

            {/* ── Dashboard Grid: Bottom Row ── */}
            {analysisResult.current_holdings && analysisResult.current_holdings.length > 0 && (
              <div className="dashboard-grid bottom-row">
                
                {/* Treemap Container Placeholder (To be implemented) */}
                <div className="card" style={{ padding: 0 }}>
                  <h3 style={{ padding: "1rem", margin: 0 }}>Allocation - Sector (Shares)</h3>
                  <div id="treemap-container">
                    <PortfolioTreemap holdings={analysisResult.current_holdings} />
                  </div>
                </div>

                {/* Sector Summary Table */}
                <div className="card" style={{ overflowX: "auto", padding: 0 }}>
                  <h3 style={{ padding: "1rem", margin: 0 }}>Sector Summary</h3>
                  <table className="holdings-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th>Sector / {t("portfolio.colTicker")}</th>
                        <th>Purchase Price (Est)</th>
                        <th>{t("portfolio.currentPrice") || "Current Price"}</th>
                        <th>Yield Cost Ratio</th>
                        <th>Sector Evaluation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisResult.current_holdings.map((h, i) => {
                        const price = h.current_value / h.quantity;
                        const isProfit = h.unrealized_pnl >= 0;
                        const estPurchase = price - (h.unrealized_pnl / h.quantity);
                        
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{h.ticker}</td>
                            <td>${estPurchase.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td>${price.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td>
                              <span style={{ 
                                display: "inline-block", 
                                width: "10px", height: "10px", 
                                borderRadius: "50%", 
                                marginRight: "8px",
                                background: isProfit ? "#00FF88" : "#FF007F",
                                boxShadow: `0 0 8px ${isProfit ? "#00FF88" : "#FF007F"}`
                              }}></span>
                              {(h.weight * 100).toFixed(2)}%
                            </td>
                            <td style={{ color: isProfit ? "#00F0FF" : "#FF007F", fontWeight: 500 }}>
                              {isProfit ? "" : "$ ("}{Math.abs(h.unrealized_pnl).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{isProfit ? "" : ")"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── AI Insights ── */}
            <div style={{ ...styles.sectionLabel, ...styles.aiLabel }}>
              <span style={styles.sectionIcon}>🤖</span>
              <span>{t("disclaimer.aiLabel")}</span>
            </div>
            <pre className="report-text white-report">{analysisResult.report_text}</pre>

            <button className="secondary" onClick={() => handleDownloadPdf(analysisResult.analysis_id)}>
              {t("portfolio.downloadPdf")}
            </button>
          </div>
        )}
      </section>

      {/* ── Rebalancing Simulator ── */}
      {analysisResult && (
        <RebalancingSimulator
          currentHoldings={analysisResult.current_holdings || []}
          targetWeights={analysisResult.target_weights || {}}
          totalValue={analysisResult.total_value}
        />
      )}

      {/* History */}
      <section className="card">
        <h2>{t("portfolio.historyTitle")}</h2>
        {history.length === 0 ? (
          <p className="empty-state">{t("portfolio.historyEmpty")}</p>
        ) : (
          <ul className="history-list">
            {history.map((h) => (
              <li key={h.id} className="history-item">
                <span>
                  {t("portfolio.historyEntry")(h.created_at, h.total_value, locale)}
                </span>
                <button className="link-button" onClick={() => handleDownloadPdf(h.id)}>
                  PDF
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const styles = {
  sectionLabel: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.78rem",
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--ink-soft)",
    margin: "1rem 0 0.5rem",
    paddingBottom: "0.3rem",
    borderBottom: "1px solid var(--hairline)",
  },
  aiLabel: {
    color: "#5558a0",
    borderBottomColor: "#d0d0f0",
  },
  sectionIcon: {
    fontSize: "1rem",
  },
};
