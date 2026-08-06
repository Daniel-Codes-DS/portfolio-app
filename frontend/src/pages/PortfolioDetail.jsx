import { useEffect, useState } from "react";
import { api } from "../api";

export default function PortfolioDetail({ token, portfolioId, onBack }) {
  const [portfolio, setPortfolio] = useState(null);
  const [history, setHistory] = useState([]);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [p, h] = await Promise.all([
        api.getPortfolio(token, portfolioId),
        api.getHistory(token, portfolioId),
      ]);
      setPortfolio(p);
      setHistory(h);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      await api.uploadFile(token, portfolioId, file);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleRunAnalysis() {
    setAnalyzing(true);
    setError("");
    setAnalysisResult(null);
    try {
      const result = await api.runAnalysis(token, portfolioId);
      setAnalysisResult(result);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleDownloadPdf(analysisId) {
    setError("");
    try {
      const { url } = await api.getPdfUrl(token, portfolioId, analysisId);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <div className="center-screen">טוען...</div>;

  const holdingsCount = portfolio?.holdings?.length || 0;

  return (
    <div className="page">
      <header className="topbar">
        <button className="secondary" onClick={onBack}>
          ‹ חזרה
        </button>
        <h1>{portfolio?.name}</h1>
      </header>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>אחזקות ({holdingsCount})</h2>

        {holdingsCount > 0 ? (
          <table className="holdings-table">
            <thead>
              <tr>
                <th>טיקר</th>
                <th>כמות</th>
                <th>מחיר קנייה</th>
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
          <p className="empty-state">עדיין אין אחזקות - העלו קובץ למטה</p>
        )}

        <label className="upload-button">
          {uploading ? "מעלה..." : "העלאת קובץ (CSV / Excel / PDF / תמונה)"}
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg"
            onChange={handleFileUpload}
            disabled={uploading}
            hidden
          />
        </label>
      </section>

      <section className="card">
        <h2>ניתוח</h2>
        <button onClick={handleRunAnalysis} disabled={analyzing || holdingsCount === 0}>
          {analyzing ? "מריץ ניתוח... (עד דקה)" : "הרץ ניתוח חדש"}
        </button>

        {analysisResult && (
          <div className="analysis-result">
            <div className="metrics-row">
              <div className="metric">
                <span className="metric-label">שווי תיק</span>
                <span className="metric-value">
                  {analysisResult.total_value?.toLocaleString("he-IL")}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">תשואה שנתית</span>
                <span
                  className="metric-value"
                  style={{
                    color:
                      analysisResult.annual_return > 0
                        ? "var(--accent)"
                        : analysisResult.annual_return < 0
                        ? "var(--danger)"
                        : undefined,
                  }}
                >
                  {analysisResult.annual_return != null
                    ? `${(analysisResult.annual_return * 100).toFixed(1)}%`
                    : "-"}
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Sharpe</span>
                <span className="metric-value">
                  {analysisResult.sharpe_ratio != null ? analysisResult.sharpe_ratio.toFixed(2) : "-"}
                </span>
              </div>
            </div>

            <pre className="report-text">{analysisResult.report_text}</pre>

            <button className="secondary" onClick={() => handleDownloadPdf(analysisResult.analysis_id)}>
              📄 הורד דוח PDF (כולל גרפים)
            </button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>היסטוריית ניתוחים</h2>
        {history.length === 0 ? (
          <p className="empty-state">אין עדיין ניתוחים קודמים</p>
        ) : (
          <ul className="history-list">
            {history.map((h) => (
              <li key={h.id} className="history-item">
                <span>
                  {new Date(h.created_at).toLocaleString("he-IL")} - שווי:{" "}
                  {h.total_value?.toLocaleString("he-IL")}
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
