import { useEffect, useState } from "react";
import { api } from "../api";
import { supabase } from "../supabaseClient";
import ButtonGroup from '../components/ButtonGroup';

const EMPTY_PROFILE = {
  investor_age: "",
  investment_horizon_years: "",
  risk_tolerance: "",
  investment_goal: "",
  liquidity_needs: "",
};

export default function Dashboard({ token, onSelectPortfolio }) {
  const [portfolios, setPortfolios] = useState([]);
  const [newName, setNewName] = useState("");
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.listPortfolios(token);
      setPortfolios(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleProfileChange(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  function buildPayload() {
    // שולחים רק שדות שמולאו בפועל - שדות ריקים נשלחים כ-null (לא כמחרוזת ריקה)
    const payload = { name: newName.trim() };
    if (profile.investor_age !== "") {
      const age = parseInt(profile.investor_age, 10);
      if (!isNaN(age) && age > 0) payload.investor_age = age;
    }
    if (profile.investment_horizon_years !== "") {
      const horizon = parseInt(profile.investment_horizon_years, 10);
      if (!isNaN(horizon) && horizon >= 0) payload.investment_horizon_years = horizon;
    }
    if (profile.risk_tolerance !== "") payload.risk_tolerance = profile.risk_tolerance;
    if (profile.investment_goal !== "") payload.investment_goal = profile.investment_goal;
    if (profile.liquidity_needs !== "") payload.liquidity_needs = profile.liquidity_needs;
    return payload;
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      await api.createPortfolio(token, buildPayload());
      setNewName("");
      setProfile(EMPTY_PROFILE);
      setShowProfile(false);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <header className="topbar">
        <h1>התיקים שלי</h1>
        <button className="secondary" onClick={() => supabase.auth.signOut()}>
          התנתק
        </button>
      </header>

      <form className="create-portfolio-form" onSubmit={handleCreate}>
        {/* שורת שם + כפתור יצירה */}
        <div className="inline-form">
          <input
            type="text"
            placeholder="שם התיק החדש"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" disabled={creating}>
            {creating ? "יוצר..." : "תיק חדש +"}
          </button>
        </div>

        {/* כפתור פתיחת/סגירת פרופיל השקעות */}
        <button
          type="button"
          className="toggle-profile-btn secondary"
          onClick={() => setShowProfile((v) => !v)}
        >
          {showProfile ? "▲ הסתר פרופיל השקעות" : "▼ הוסף פרופיל השקעות (אופציונלי)"}
        </button>

        {/* פאנל פרופיל השקעות */}
        {showProfile && (
          <div className="investor-profile-panel card">
            <p className="profile-hint">
              פרטים אלה יסייעו לאנליזה להתאים את ההמלצות לפרופיל האישי שלך.
              ניתן למלא חלק מהשדות או לדלג לגמרי – הניתוח יעבוד בכל מקרה.
            </p>

            {/* כאן נכנס העיצוב החדש עם ה-ButtonGroup */}
            <div className="profile-buttons-wrapper">
              
              {/* 1. גיל המשקיע */}
              <div style={{ marginBottom: "1rem" }}>
                <ButtonGroup
                  label="גיל המשקיע"
                  value={profile.investor_age}
                  onChange={(val) => handleProfileChange("investor_age", val)}
                  options={[
                    { label: "עד 30", value: 25 },
                    { label: "30-45", value: 37 },
                    { label: "45-60", value: 52 },
                    { label: "60+", value: 65 },
                    { label: "לא משנה", value: "" },
                  ]}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "-0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>גיל מדויק:</span>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    placeholder="35"
                    value={profile.investor_age}
                    onChange={(e) => handleProfileChange("investor_age", e.target.value)}
                    style={{ width: "80px", padding: "0.25rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border)" }}
                  />
                </div>
              </div>

              {/* 2. אופק השקעה */}
              <ButtonGroup
                label="אופק השקעה"
                value={profile.investment_horizon_years}
                onChange={(val) => handleProfileChange("investment_horizon_years", val)}
                options={[
                  { label: "עד שנתיים", value: 1 },
                  { label: "3-5 שנים", value: 4 },
                  { label: "5-10 שנים", value: 7 },
                  { label: "10-20 שנה", value: 15 },
                  { label: "20+ שנה", value: 25 },
                  { label: "לא משנה", value: "" },
                ]}
              />

              {/* 3. רמת סיכון */}
              <ButtonGroup
                label="רמת סיכון מועדפת"
                value={profile.risk_tolerance}
                onChange={(val) => handleProfileChange("risk_tolerance", val)}
                options={[
                  { label: "שמרני", value: "conservative" },
                  { label: "מאוזן", value: "balanced" },
                  { label: "אגרסיבי", value: "aggressive" },
                  { label: "לא משנה", value: "" },
                ]}
              />

              {/* 4. מטרת ההשקעה */}
              <ButtonGroup
                label="מטרת ההשקעה"
                value={profile.investment_goal}
                onChange={(val) => handleProfileChange("investment_goal", val)}
                options={[
                  { label: "פרישה לגמלאות", value: "retirement" },
                  { label: "רכישת דירה / נדל\"ן", value: "home_purchase" },
                  { label: "חיסכון כללי", value: "general_savings" },
                  { label: "אחר", value: "other" },
                  { label: "לא משנה", value: "" },
                ]}
              />

              {/* 5. צורכי נזילות */}
              <ButtonGroup
                label="צורכי נזילות"
                value={profile.liquidity_needs}
                onChange={(val) => handleProfileChange("liquidity_needs", val)}
                options={[
                  { label: "נמוכה (כסף נעול)", value: "low" },
                  { label: "בינונית", value: "medium" },
                  { label: "גבוהה (נדרש בקרוב)", value: "high" },
                  { label: "לא משנה", value: "" },
                ]}
              />

            </div>
          </div>
        )}
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>טוען...</p>
      ) : portfolios.length === 0 ? (
        <p className="empty-state">אין לך עדיין תיקים – צור תיק חדש למעלה</p>
      ) : (
        <ul className="portfolio-list">
          {portfolios.map((p) => (
            <li key={p.id} className="portfolio-card" onClick={() => onSelectPortfolio(p.id)}>
              <span className="portfolio-name">{p.name}</span>
              <span className="chevron">‹</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}