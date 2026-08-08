import { useEffect, useState } from "react";
import { api } from "../api";
import { supabase } from "../supabaseClient";
import ButtonGroup from "../components/ButtonGroup";
import { useLang } from "../i18n/LangContext";

const EMPTY_PROFILE = {
  investor_age: "",
  investment_horizon_years: "",
  risk_tolerance: "",
  investment_goal: "",
  liquidity_needs: "",
};

export default function Dashboard({ token, onSelectPortfolio }) {
  const { t } = useLang();
  const [portfolios, setPortfolios] = useState([]);
  const [newName, setNewName]       = useState("");
  const [profile, setProfile]       = useState(EMPTY_PROFILE);
  const [showProfile, setShowProfile] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [creating, setCreating]     = useState(false);
  const [error, setError]           = useState("");
  const [selectedFile, setSelectedFile] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    setLoading(true); setError("");
    try { setPortfolios(await api.listPortfolios(token)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  function handleProfileChange(field, value) {
    setProfile((prev) => ({ ...prev, [field]: value }));
  }

  function buildPayload() {
    const payload = { name: newName.trim() };
    if (profile.investor_age !== "") {
      const age = parseInt(profile.investor_age, 10);
      if (!isNaN(age) && age > 0) payload.investor_age = age;
    }
    if (profile.investment_horizon_years !== "") {
      const h = parseInt(profile.investment_horizon_years, 10);
      if (!isNaN(h) && h >= 0) payload.investment_horizon_years = h;
    }
    if (profile.risk_tolerance !== "")           payload.risk_tolerance = profile.risk_tolerance;
    if (profile.investment_goal !== "")          payload.investment_goal = profile.investment_goal;
    if (profile.liquidity_needs !== "")          payload.liquidity_needs = profile.liquidity_needs;
    return payload;
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true); setError("");
    try {
      const p = await api.createPortfolio(token, buildPayload());
      
      // If a file was selected, upload it immediately to the new portfolio
      if (selectedFile && p && p.id) {
        await api.uploadFile(token, p.id, selectedFile);
      }

      setNewName(""); setProfile(EMPTY_PROFILE); setShowProfile(false); setSelectedFile(null);
      
      // Reset file input element if possible
      const fileInput = document.getElementById("dashboard-file-upload");
      if (fileInput) fileInput.value = "";
      
      await load();
    } catch (e) { setError(e.message); }
    finally { setCreating(false); }
  }

  const p = t("dashboard.profile");

  return (
    <div className="page">
      <header className="topbar">
        <h1>{t("dashboard.title")}</h1>
        <button className="secondary" onClick={() => supabase.auth.signOut()}>
          {t("nav.signOut")}
        </button>
      </header>

      <form className="create-portfolio-form" onSubmit={handleCreate}>
        <div className="inline-form">
          <input
            type="text"
            placeholder={t("dashboard.namePlaceholder")}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit" disabled={creating}>
            {creating ? t("dashboard.creating") : t("dashboard.createBtn")}
          </button>
        </div>

        <div className="inline-form" style={{ marginTop: "1rem" }}>
          <label className="upload-button secondary" style={{ margin: 0, padding: "0.5rem 1rem", cursor: "pointer", display: "inline-block", backgroundColor: selectedFile ? "var(--accent)" : undefined, color: selectedFile ? "white" : undefined }}>
            {selectedFile ? `📄 ${selectedFile.name}` : (t("dashboard.importCsv") || "Import CSV/Excel (Optional)")}
            <input
              id="dashboard-file-upload"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => setSelectedFile(e.target.files[0])}
              disabled={creating}
              hidden
            />
          </label>
        </div>

        <button
          type="button"
          className="toggle-profile-btn secondary"
          onClick={() => setShowProfile((v) => !v)}
        >
          {showProfile ? t("dashboard.hideProfile") : t("dashboard.showProfile")}
        </button>

        {showProfile && (
          <div className="investor-profile-panel card">
            <p className="profile-hint">{t("dashboard.profileHint")}</p>

            <div className="profile-buttons-wrapper">
              {/* Age */}
              <div style={{ marginBottom: "1rem" }}>
                <ButtonGroup
                  label={p.ageLabel}
                  value={profile.investor_age}
                  onChange={(val) => handleProfileChange("investor_age", val)}
                  options={p.ageOpts}
                />
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "-0.5rem" }}>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{p.ageExact}</span>
                  <input
                    type="number" min="1" max="120" placeholder="35"
                    value={profile.investor_age}
                    onChange={(e) => handleProfileChange("investor_age", e.target.value)}
                    style={{ width: "80px", padding: "0.25rem 0.5rem", borderRadius: "4px", border: "1px solid var(--border)" }}
                  />
                </div>
              </div>

              {/* Horizon */}
              <ButtonGroup
                label={p.horizonLabel}
                value={profile.investment_horizon_years}
                onChange={(val) => handleProfileChange("investment_horizon_years", val)}
                options={p.horizonOpts}
              />

              {/* Risk */}
              <ButtonGroup
                label={p.riskLabel}
                value={profile.risk_tolerance}
                onChange={(val) => handleProfileChange("risk_tolerance", val)}
                options={p.riskOpts}
              />

              {/* Goal */}
              <ButtonGroup
                label={p.goalLabel}
                value={profile.investment_goal}
                onChange={(val) => handleProfileChange("investment_goal", val)}
                options={p.goalOpts}
              />

              {/* Liquidity */}
              <ButtonGroup
                label={p.liquidityLabel}
                value={profile.liquidity_needs}
                onChange={(val) => handleProfileChange("liquidity_needs", val)}
                options={p.liquidityOpts}
              />
            </div>
          </div>
        )}
      </form>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p>{t("loading")}</p>
      ) : portfolios.length === 0 ? (
        <p className="empty-state">{t("dashboard.empty")}</p>
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