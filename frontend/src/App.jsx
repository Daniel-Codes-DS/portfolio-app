import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import PortfolioDetail from "./pages/PortfolioDetail";
import CashRecommendation from "./pages/CashRecommendation";
import ErrorBoundary from "./ErrorBoundary";

function AppContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' או 'cash_recommendation'

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
    return <div className="center-screen">טוען...</div>;
  }

  if (!session) {
    return <Login />;
  }

  const token = session.access_token;

  return (
    <div className="app-container">
      {/* סרגל ניווט עליון (Navbar) */}
      <nav
        className="main-nav"
        style={{
          display: "flex",
          gap: "1rem",
          padding: "1rem 2rem",
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          direction: "rtl",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setActiveTab("dashboard");
            setSelectedPortfolioId(null);
          }}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            border: "none",
            backgroundColor:
              activeTab === "dashboard" ? "var(--accent, #1f7a6c)" : "transparent",
            color: activeTab === "dashboard" ? "#fff" : "var(--text)",
            fontWeight: activeTab === "dashboard" ? 600 : 400,
            cursor: "pointer",
          }}
        >
          התיקים שלי
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab("cash_recommendation");
            setSelectedPortfolioId(null);
          }}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "6px",
            border: "none",
            backgroundColor:
              activeTab === "cash_recommendation" ? "var(--accent, #1f7a6c)" : "transparent",
            color: activeTab === "cash_recommendation" ? "#fff" : "var(--text)",
            fontWeight: activeTab === "cash_recommendation" ? 600 : 400,
            cursor: "pointer",
          }}
        >
          המלצת פיזור מזומן
        </button>
      </nav>

      {/* תצוגת הרכיב הפעיל */}
      <main>
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
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}