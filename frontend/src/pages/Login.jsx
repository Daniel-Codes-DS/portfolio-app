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

  async function handleGoogleLogin() {
    setLoading(true); setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
      });
      if (error) throw error;
    } catch (e) {
      setError(e.message);
      setLoading(false);
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

        <div style={{ textAlign: "center", margin: "1rem 0", color: "var(--text-muted)" }}>
          {t("login.or") || "--- OR ---"}
        </div>

        <button 
          type="button" 
          onClick={handleGoogleLogin} 
          disabled={loading}
          className="secondary"
          style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "0.5rem", width: "100%", backgroundColor: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink)" }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {t("login.googleBtn") || "Sign in with Google"}
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
