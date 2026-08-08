import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PortfolioDetail from "./pages/PortfolioDetail";
import CashRecommendation from "./pages/CashRecommendation";
import ErrorBoundary from "./ErrorBoundary";
import { LangProvider, useLang } from "./i18n/LangContext";
import Footer from "./components/Footer";

function AppContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [theme, setTheme] = useState(() => localStorage.getItem("portfolio_app_theme") || "light");
  const { lang, toggleLang, t, dir } = useLang();

  // Sync document direction/language with chosen lang on first render
  useEffect(() => {
    document.documentElement.setAttribute("dir", dir);
    document.documentElement.setAttribute("lang", lang);
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("portfolio_app_theme", theme);
    document.title = t("appName");
  }, [lang, dir, t, theme]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setSelectedPortfolioId(null);
        setActiveTab("dashboard");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="center-screen">{t("loading")}</div>;
  }

  if (!session) {
    return <Login />;
  }

  const token = session.access_token;

  const navBtnStyle = (active) => ({
    padding: "0.5rem 1rem",
    borderRadius: "6px",
    border: "none",
    backgroundColor: active ? "var(--accent, #1f7a6c)" : "transparent",
    color: active ? "#fff" : "var(--text)",
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
  });

  const langBtnStyle = {
    padding: "0.4rem 0.85rem",
    borderRadius: "6px",
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontSize: "0.85rem",
    fontWeight: 500,
    marginInlineStart: "auto",  // pushes to the far end regardless of dir
  };

  return (
    <div className="app-container" style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <nav
        className="main-nav"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          padding: "1rem 2rem",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <button
          id="nav-portfolios"
          type="button"
          onClick={() => { setActiveTab("dashboard"); setSelectedPortfolioId(null); }}
          style={navBtnStyle(activeTab === "dashboard")}
        >
          {t("nav.myPortfolios")}
        </button>

        <button
          id="nav-cash"
          type="button"
          onClick={() => { setActiveTab("cash_recommendation"); setSelectedPortfolioId(null); }}
          style={navBtnStyle(activeTab === "cash_recommendation")}
        >
          {t("nav.cashAllocation")}
        </button>

        {/* Language toggle - always at the far end */}
        <button
          id="btn-lang-toggle"
          type="button"
          onClick={toggleLang}
          style={langBtnStyle}
          title={lang === "en" ? "Switch to Hebrew" : "עבור לאנגלית"}
          aria-label="Toggle language"
        >
          🌐 {t("nav.langToggle")}
        </button>
        
        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          style={{
            ...langBtnStyle,
            marginInlineStart: "0.5rem",
          }}
          title="Toggle Theme"
        >
          {theme === "light" ? "🌙" : "☀️"}
        </button>
      </nav>

      <main style={{ flex: 1 }}>
        {activeTab === "cash_recommendation" ? (
          <CashRecommendation token={token} />
        ) : selectedPortfolioId ? (
          <PortfolioDetail
            token={token}
            portfolioId={selectedPortfolioId}
            onBack={() => setSelectedPortfolioId(null)}
          />
        ) : (
          <Dashboard token={token} onSelectPortfolio={setSelectedPortfolioId} />
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <LangProvider>
        <AppContent />
      </LangProvider>
    </ErrorBoundary>
  );
}