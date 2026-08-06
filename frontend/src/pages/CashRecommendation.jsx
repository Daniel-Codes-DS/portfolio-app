import React, { useState } from "react";
import ButtonGroup from "../components/ButtonGroup";
import { api } from "../api";

export default function CashRecommendation({ token, portfolioId = null, initialProfile = {} }) {
  const [cashAmount, setCashAmount] = useState("");
  const [profile, setProfile] = useState({
    investor_age: initialProfile.investor_age || "",
    investment_horizon_years: initialProfile.investment_horizon_years || "",
    risk_tolerance: initialProfile.risk_tolerance || "",
    investment_goal: initialProfile.investment_goal || "",
    liquidity_needs: initialProfile.liquidity_needs || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const updateProfile = (field, val) => {
    setProfile((prev) => ({ ...prev, [field]: val }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!cashAmount || Number(cashAmount) <= 0) {
      setError("נא להזין סכום מזומן פנוי תקין בש\"ח");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    const payload = {
      cash_amount: Number(cashAmount),
      portfolio_id: portfolioId,
      ...(profile.investor_age !== "" && { investor_age: Number(profile.investor_age) }),
      ...(profile.investment_horizon_years !== "" && { investment_horizon_years: Number(profile.investment_horizon_years) }),
      ...(profile.risk_tolerance && { risk_tolerance: profile.risk_tolerance }),
      ...(profile.investment_goal && { investment_goal: profile.investment_goal }),
      ...(profile.liquidity_needs && { liquidity_needs: profile.liquidity_needs }),
    };

    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE}/recommendations/cash-allocation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "כשל בקבלת ההמלצה");
      }

      const data = await res.json();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page" style={{ direction: "rtl", maxWidth: "800px", margin: "0 auto", padding: "1.5rem" }}>
      <h2>המלצת פיזור מזומן חדש</h2>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        הזן סכום מזומן פנוי וקבל המלצה מותאמת אישית לפיזור ההשקעה.
      </p>

      <form onSubmit={handleSubmit} className="card" style={{ padding: "1.5rem", marginBottom: "2rem" }}>
        <div style={{ marginBottom: "1.5rem" }}>
          <label style={{ display: "block", fontWeight: 600, marginBottom: "0.5rem" }}>
            סכום מזומן פנוי להשקעה (בש"ח) *
          </label>
          <input
            type="number"
            min="1"
            placeholder="למשל: 50000"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
            style={{
              width: "100%",
              padding: "0.6rem 0.8rem",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              fontSize: "1.1rem",
              fontFamily: "var(--font-mono)"
            }}
            required
          />
        </div>

        {/* 5 שדות פרופיל בשימוש חוזר ב-ButtonGroup */}
        <h3 style={{ fontSize: "1.05rem", marginBottom: "1rem" }}>פרופיל משקיע (אופציונלי)</h3>
        
        <ButtonGroup
          label="גיל"
          value={profile.investor_age}
          onChange={(val) => updateProfile("investor_age", val)}
          options={[
            { label: "עד 30", value: 25 },
            { label: "30-45", value: 37 },
            { label: "45-60", value: 52 },
            { label: "60+", value: 65 },
            { label: "לא משנה", value: "" },
          ]}
        />

        <ButtonGroup
          label="אופק השקעה"
          value={profile.investment_horizon_years}
          onChange={(val) => updateProfile("investment_horizon_years", val)}
          options={[
            { label: "עד שנתיים", value: 1 },
            { label: "3-5 שנים", value: 4 },
            { label: "5-10 שנים", value: 7 },
            { label: "10+ שנים", value: 15 },
            { label: "לא משנה", value: "" },
          ]}
        />

        <ButtonGroup
          label="רמת סיכון"
          value={profile.risk_tolerance}
          onChange={(val) => updateProfile("risk_tolerance", val)}
          options={[
            { label: "שמרני", value: "conservative" },
            { label: "מאוזן", value: "balanced" },
            { label: "אגרסיבי", value: "aggressive" },
            { label: "לא משנה", value: "" },
          ]}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.8rem",
            backgroundColor: "var(--accent, #1f7a6c)",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: loading ? "wait" : "pointer"
          }}
        >
          {loading ? "מחשב המלצה..." : "קבל המלצת פיזור"}
        </button>
      </form>

      {error && <p className="error" style={{ color: "var(--danger)", marginBottom: "1rem" }}>{error}</p>}

      {/* תצוגת תוצאות */}
      {result && (
        <div className="card" style={{ padding: "1.5rem", borderInlineStart: "4px solid var(--accent, #1f7a6c)" }}>
          <h3>תוצאת המלצת הפיזור</h3>
          <p style={{ background: "var(--surface-muted)", padding: "1rem", borderRadius: "6px" }}>
            {result.summary_text}
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "1.5rem" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)", textAlign: "right" }}>
                <th style={{ padding: "0.5rem" }}>קטגוריה</th>
                <th style={{ padding: "0.5rem" }}>אחוז (%)</th>
                <th style={{ padding: "0.5rem" }}>סכום (בש"ח)</th>
                <th style={{ padding: "0.5rem" }}>נימוק</th>
              </tr>
            </thead>
            <tbody>
              {result.allocation.map((item, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.75rem 0.5rem", fontWeight: 600 }}>{item.category_label}</td>
                  <td style={{ padding: "0.75rem 0.5rem", fontFamily: "var(--font-mono)" }}>{item.percentage}%</td>
                  <td style={{ padding: "0.75rem 0.5rem", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    ₪{item.amount.toLocaleString()}
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
