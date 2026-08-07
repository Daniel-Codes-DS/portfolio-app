import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useLang } from "../i18n/LangContext";

// Consent text version — bump this string if the consent text ever changes.
// Stored in user_consents table for legal audit trail.

export default function Login() {
  const { t } = useLang();
  const [email, setEmail]           = useState("");
  const [password, setPassword]     = useState("");
  const [mode, setMode]             = useState("login");
  const [error, setError]           = useState("");
  const [info, setInfo]             = useState("");
  const [loading, setLoading]       = useState(false);
  const [consentChecked, setConsent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);

    if (mode === "signup" && !consentChecked) {
      setError(t("login.consentRequired"));
      setLoading(false);
      return;
    }

    const { data, error: authError } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (authError) { setError(authError.message); return; }

    if (mode === "signup") {
      // Record consent in DB for legal audit. Non-blocking — failure does not prevent signup.
      const userId = data?.user?.id;
      if (userId) {
        const consentVersion = t("consent.version"); // "v1.0-he" / "v1.0-en"
        supabase.from("user_consents").insert({
          user_id: userId,
          consent_given_at: new Date().toISOString(),
          consent_text_version: consentVersion,
        }).then(({ error: consentErr }) => {
          if (consentErr) {
            console.warn("Consent audit log failed (non-blocking):", consentErr.message);
          }
        });
      }

      if (!data.session) {
        setInfo(t("login.emailSent"));
      }
    }
  }

  return (
    <div className="center-screen">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>{t("login.title")}</h1>
        <p className="subtitle">
          {mode === "login" ? t("login.subtitle_login") : t("login.subtitle_signup")}
        </p>

        <label htmlFor="email">{t("login.email")}</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />

        <label htmlFor="password">{t("login.password")}</label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
        />

        {/* Consent Gate — shown only during signup */}
        {mode === "signup" && (
          <div
            id="consent-section"
            style={{
              marginTop: "1rem",
              padding: "0.85rem",
              background: "#f4f6f5",
              borderRadius: "8px",
              border: "1px solid #dde3e0",
              fontSize: "0.82rem",
              lineHeight: 1.6,
              color: "#12202b",
            }}
          >
            <p style={{ margin: "0 0 0.75rem", fontWeight: 600, color: "#7a5c00" }}>
              ⚠️ {mode === "signup" ? t("login.subtitle_signup") : ""}
            </p>
            <p style={{ margin: "0 0 0.75rem" }}>{t("consent.text")}</p>
            <label
              htmlFor="consent-checkbox"
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              <input
                id="consent-checkbox"
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsent(e.target.checked)}
                style={{ marginTop: "0.2rem", width: "1rem", height: "1rem", flexShrink: 0 }}
              />
              {t("consent.checkboxLabel")}
            </label>
          </div>
        )}

        {error && <p className="error">{error}</p>}
        {info  && <p className="info">{info}</p>}

        <button
          type="submit"
          disabled={loading || (mode === "signup" && !consentChecked)}
        >
          {loading
            ? t("login.loading")
            : mode === "login"
            ? t("login.submit_login")
            : t("login.submit_signup")}
        </button>

        <button
          type="button"
          className="link-button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(""); setInfo(""); setConsent(false);
          }}
        >
          {mode === "login" ? t("login.switchToSignup") : t("login.switchToLogin")}
        </button>
      </form>
    </div>
  );
}
