import { useState } from "react";
import { supabase } from "../supabaseClient";
import { useLang } from "../i18n/LangContext";

export default function Login() {
  const { t } = useLang();
  const [email, setEmail]     = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode]       = useState("login");
  const [error, setError]     = useState("");
  const [info, setInfo]       = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(""); setInfo(""); setLoading(true);

    const { data, error: authError } =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (authError) { setError(authError.message); return; }
    if (mode === "signup" && !data.session) {
      setInfo(t("login.emailSent"));
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

        {error && <p className="error">{error}</p>}
        {info  && <p className="info">{info}</p>}

        <button type="submit" disabled={loading}>
          {loading
            ? t("login.loading")
            : mode === "login"
            ? t("login.submit_login")
            : t("login.submit_signup")}
        </button>

        <button
          type="button"
          className="link-button"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); setInfo(""); }}
        >
          {mode === "login" ? t("login.switchToSignup") : t("login.switchToLogin")}
        </button>
      </form>
    </div>
  );
}
