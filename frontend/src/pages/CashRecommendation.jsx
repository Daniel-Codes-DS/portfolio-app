import React, { useState } from "react";
import ButtonGroup from "../components/ButtonGroup";
import { api } from "../api";
import { useLang } from "../i18n/LangContext";

export default function CashRecommendation({ token, portfolioId = null, initialProfile = {} }) {
  const { t, locale } = useLang();
  const s = t("cash");   // shorthand for the cash namespace

  const [cashAmount, setCashAmount] = useState("");
  const [profile, setProfile] = useState({
    investor_age:             initialProfile.investor_age             || "",
    investment_horizon_years: initialProfile.investment_horizon_years || "",
    risk_tolerance:           initialProfile.risk_tolerance           || "",
    investment_goal:          initialProfile.investment_goal          || "",
    liquidity_needs:          initialProfile.liquidity_needs          || "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [result, setResult]   = useState(null);

  const updateProfile = (field, val) =>
    setProfile((prev) => ({ ...prev, [field]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cashAmount || Number(cashAmount) <= 0) {
      setError(s.errorEmpty);
      return;
    }
    setLoading(true); setError(""); setResult(null);

    const payload = {
      cash_amount:  Number(cashAmount),
      portfolio_id: portfolioId,
      ...(profile.investor_age             !== "" && { investor_age: Number(profile.investor_age) }),
      ...(profile.investment_horizon_years !== "" && { investment_horizon_years: Number(profile.investment_horizon_years) }),
      ...(profile.risk_tolerance           && { risk_tolerance:  profile.risk_tolerance }),
      ...(profile.investment_goal          && { investment_goal: profile.investment_goal }),
      ...(profile.liquidity_needs          && { liquidity_needs: profile.liquidity_needs }),
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/recommendations/cash-allocation`, {
        method: "POST",
        headers: {
          "Content-Type":    "application/json",
          "Authorization":   `Bearer ${token}`,
          "X-App-Language":  localStorage.getItem("portfolio_app_lang") || "en",
          "Accept-Language": localStorage.getItem("portfolio_app_lang") || "en",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || s.errorGeneric);
      }
      setResult(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ maxWidth: "800px", margin: "0 auto", padding: "1.5rem" }}>
      <h2>{s.title}</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>{s.subtitle}</p>

      <form onSubmit={handleSubmit} className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
            {s.amountLabel}
          </label>
          <input
            type="number" min="1" placeholder={s.amountPlaceholder}
            value={cashAmount} onChange={(e) => setCashAmount(e.target.value)}
            style={{ width: "100%", padding: "0.6rem 0.8rem", borderRadius: "6px",
                     border: "1px solid var(--border)", fontSize: "1.1rem",
                     fontFamily: "var(--font-mono)" }}
            required
          />
        </div>

        <h3 style={{ fontSize: "1.05rem", marginBottom: "1rem" }}>{s.profileTitle}</h3>

        <ButtonGroup
          label={s.ageLabel}
          value={profile.investor_age}
          onChange={(val) => updateProfile("investor_age", val)}
          options={s.ageOpts}
        />
        <ButtonGroup
          label={s.horizonLabel}
          value={profile.investment_horizon_years}
          onChange={(val) => updateProfile("investment_horizon_years", val)}
          options={s.horizonOpts}
        />
        <ButtonGroup
          label={s.riskLabel}
          value={profile.risk_tolerance}
          onChange={(val) => updateProfile("risk_tolerance", val)}
          options={s.riskOpts}
        />

        <button
          type="submit" disabled={loading}
          style={{ width: "100%", padding: "0.8rem", backgroundColor: "var(--accent, #1f7a6c)",
                   color: "#fff", border: "none", borderRadius: "6px",
                   fontWeight: "bold", cursor: loading ? "wait" : "pointer" }}
        >
          {loading ? s.loading : s.submitBtn}
        </button>
      </form>

      {error && <p className="error" style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>}

      {result && (
        <div className="card" style={{ padding: "1.5rem", borderInlineStart: "4px solid var(--accent, #1f7a6c)" }}>
          <h3>{s.resultTitle}</h3>
          <p style={{ background: "var(--surface-muted)", padding: "1rem", borderRadius: "6px" }}>
            {result.summary_text}
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ padding: "0.5rem" }}>{s.colCategory}</th>
                <th style={{ padding: "0.5rem" }}>{s.colPercent}</th>
                <th style={{ padding: "0.5rem" }}>{s.colAmount}</th>
                <th style={{ padding: "0.5rem" }}>{s.colReason}</th>
              </tr>
            </thead>
            <tbody>
              {result.allocation.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>{item.category_label}</td>
                  <td style={{ padding: "0.75rem 0.5rem", fontFamily: "var(--font-mono)" }}>{item.percentage}%</td>
                  <td style={{ padding: "0.75rem 0.5rem", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    {item.amount.toLocaleString(locale)}
                  </td>
                  <td style={{ padding: "0.75rem 0.5rem", fontSize: "0.9rem" }}>{item.reasoning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
