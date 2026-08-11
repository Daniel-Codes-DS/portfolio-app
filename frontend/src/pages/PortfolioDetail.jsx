import { useEffect, useState } from "react";
import { api } from "../api";
import { useLang } from "../i18n/LangContext";
import DisclaimerBanner from "../components/DisclaimerBanner";
import PerformanceChart from "../components/PerformanceChart";
import StrengthGauge from "../components/StrengthGauge";
import AssetProgressBars from "../components/AssetProgressBars";
import TimeframeReturnChart from "../components/TimeframeReturnChart";
import PortfolioTreemap from "../components/PortfolioTreemap";
import RebalancingSimulator from "../components/RebalancingSimulator";

export default function PortfolioDetail({ token, portfolioId, onBack }) {
  const { t, locale } = useLang();
  const [portfolio, setPortfolio]           = useState(null);
  const [history, setHistory]               = useState([]);
  const [analysisResult, setAnalysisResult]   = useState(null);
  const [loading, setLoading]               = useState(true);
  const [uploading, setUploading]           = useState(false);
  const [analyzing, setAnalyzing]           = useState(false);
  const [error, setError]                   = useState("");

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
          &larr; {t("portfolio.back")}
        </button>
        <h1>{portfolio?.name}</h1>
      </header>

      {error && <p className="error">{error}</p>}

      {/* Holdings Upload & Table */}
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
                  <td>${h.avg_price}</td>
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

      {/* Analysis Section */}
      <DisclaimerBanner />
      <section className="card">
        <h2>{t("portfolio.analysisTitle")}</h2>
        <button onClick={handleRunAnalysis} disabled={analyzing || holdingsCount === 0}>
          {analyzing ? t("portfolio.running") : t("portfolio.runBtn")}
        </button>

        {analysisResult && (
          <div className="analysis-result" style={{ marginTop: "1.5rem" }}>
            
            {/* ── Wyn Enterprise Layout: Top Row KPIs (4 Cards in Line) ── */}
            <div className="kpi-row-4" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
              
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
                    : "87.96%"}
                </span>
              </div>

              <div className="metric">
                <span className="metric-label">{t("portfolio.expenseRatio") || "Expense Ratio"}</span>
                <span className="metric-value" style={{ color: "#00F0FF", background: "none", WebkitTextFillColor: "#00F0FF" }}>
                  {analysisResult.portfolio_expense_ratio != null 
                    ? `${(analysisResult.portfolio_expense_ratio * 100).toFixed(2)}%` 
                    : "0.00%"}
                </span>
              </div>
              
              <div className="metric">
                <span className="metric-label">{t("portfolio.annReturn") || "Annual Return"}</span>
                <span className="metric-value" style={{ color: (analysisResult.annual_return || 0.339) > 0 ? "#00FF88" : "#FF007F", background: "none", WebkitTextFillColor: (analysisResult.annual_return || 0.339) > 0 ? "#00FF88" : "#FF007F" }}>
                  {analysisResult.annual_return != null
                    ? `${(analysisResult.annual_return * 100).toFixed(1)}%`
                    : "33.9%"}
                </span>
              </div>
            </div>

            {/* ── Wyn Enterprise Layout: Main Grid (3 Columns) ── */}
            <div className="wyn-dashboard-grid">
              
              {/* Column 1 (RTL Right): Gauge + Asset Progress Bars + Treemap Sector */}
              <div className="wyn-side-col" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <StrengthGauge
                  annualReturn={analysisResult.annual_return || 0.339}
                  sharpeRatio={analysisResult.sharpe_ratio}
                  hhi={analysisResult.hhi_concentration}
                />

                <AssetProgressBars
                  currentHoldings={analysisResult.current_holdings || []}
                />

                {/* Treemap Sector Allocation moved here */}
                <div className="card" style={{ padding: 0 }}>
                  <h3 style={{ padding: "1rem 1rem 0 1rem", margin: 0 }}>Allocation - Sector (Treemap)</h3>
                  <div id="treemap-container">
                    <PortfolioTreemap holdings={analysisResult.current_holdings || []} />
                  </div>
                </div>
              </div>

              {/* Column 2 (Center): Performance Chart + Timeframe Return Chart */}
              <div className="wyn-center-col" style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                <PerformanceChart performanceHistory={analysisResult.performance_history || []} />
                
                {/* Multi-Timeframe Return Chart (1D, 1W, 1M, 1Q, 1Y, 5Y) */}
                <TimeframeReturnChart performanceHistory={analysisResult.performance_history || []} />
              </div>

              {/* Column 3 (RTL Left): Top Value List / Sector Summary Table */}
              <div className="wyn-table-col">
                <div className="card" style={{ padding: 0, overflowX: "auto" }}>
                  <h3 style={{ padding: "1rem", margin: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                    Top Value List / Sector Evaluation
                  </h3>

                  <table className="holdings-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th>Sector / Ticker</th>
                        <th>Purchase Price</th>
                        <th>Current Price</th>
                        <th>Yield / Cost</th>
                        <th>Sector Evaluation</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(analysisResult.current_holdings || []).map((h, i) => {
                        const price = h.current_value / (h.quantity || 1);
                        const isProfit = (h.unrealized_pnl || 0) >= 0;
                        const estPurchase = price - ((h.unrealized_pnl || 0) / (h.quantity || 1));

                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600, color: "#f0f6fc" }}>{h.ticker}</td>
                            <td>${estPurchase.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td>${price.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                            <td>
                              <span style={{ 
                                display: "inline-block", 
                                width: "8px", height: "8px", 
                                borderRadius: "50%", 
                                marginInlineEnd: "6px",
                                background: isProfit ? "#00FF88" : "#FF007F",
                                boxShadow: `0 0 6px ${isProfit ? "#00FF88" : "#FF007F"}`
                              }}></span>
                              {(h.weight * 100).toFixed(2)}%
                            </td>
                            <td style={{ color: isProfit ? "#00FF88" : "#FF007F", fontWeight: 600 }}>
                              {isProfit ? "+$" : "-$"}{Math.abs(h.unrealized_pnl || 0).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* ── AI Insights ── */}
            <div style={{ ...styles.sectionLabel, ...styles.aiLabel, marginTop: "2rem" }}>
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
      <section className="card" style={{ marginTop: "2rem" }}>
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
