import { useEffect, useState } from "react";
import { api } from "../api";
import { useLang } from "../i18n/LangContext";
import DisclaimerBanner from "../components/DisclaimerBanner";

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
    <div className="page">
      <header className="topbar">
        <button className="secondary" onClick={onBack}>{t("portfolio.back")}</button>
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
            {/* ── Factual Data ── */}
            <div style={styles.sectionLabel}>
              <span style={styles.sectionIcon}>📊</span>
              <span>{t("disclaimer.factsLabel")}</span>
            </div>
            <div className="metrics-row">
              <div className="metric">
                <span className="metric-label">{t("portfolio.portfolioValue")}</span>
                <span className="metric-value">
                  {analysisResult.total_value?.toLocaleString(locale)}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">{t("portfolio.annReturn")}</span>
                <span
                  className="metric-value"
                  style={{
                    color:
                      analysisResult.annual_return > 0 ? "var(--accent)"
                      : analysisResult.annual_return < 0 ? "var(--danger)"
                      : undefined,
                  }}
                >
                  {analysisResult.annual_return != null
                    ? `${(analysisResult.annual_return * 100).toFixed(1)}%`
                    : "-"}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">{t("portfolio.sharpe")}</span>
                <span className="metric-value">
                  {analysisResult.sharpe_ratio != null ? analysisResult.sharpe_ratio.toFixed(2) : "-"}
                </span>
              </div>
            </div>

            {/* ── AI Analysis ── */}
            <div style={{ ...styles.sectionLabel, ...styles.aiLabel }}>
              <span style={styles.sectionIcon}>🤖</span>
              <span>{t("disclaimer.aiLabel")}</span>
            </div>
            <pre className="report-text">{analysisResult.report_text}</pre>

            <button className="secondary" onClick={() => handleDownloadPdf(analysisResult.analysis_id)}>
              {t("portfolio.downloadPdf")}
            </button>
          </div>
        )}
      </section>

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
