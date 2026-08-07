import { useState } from "react";
import { useLang } from "../i18n/LangContext";

/**
 * DisclaimerBanner - shown at the top of any page displaying AI analysis results.
 * Can be collapsed to a single line, but CANNOT be permanently dismissed.
 * Text is sourced from i18n "disclaimer.short" — same source of truth as _DISCLAIMER in pdf_report.py.
 */
export default function DisclaimerBanner() {
  const { t } = useLang();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      id="disclaimer-banner"
      role="note"
      aria-label={t("disclaimer.short")}
      style={{
        background: "#fff8e6",
        borderBottom: collapsed ? "none" : "1px solid #f0d080",
        borderTop: "1px solid #f0d080",
        padding: collapsed ? "0.45rem 1.25rem" : "0.75rem 1.25rem",
        display: "flex",
        alignItems: "flex-start",
        gap: "0.6rem",
        fontSize: "0.82rem",
        lineHeight: 1.55,
        color: "#7a5c00",
        transition: "padding 0.15s ease",
      }}
    >
      <span style={{ fontSize: "1rem", flexShrink: 0, marginTop: "0.05rem" }}>⚠️</span>

      {collapsed ? (
        <span style={{ opacity: 0.8, flex: 1 }}>
          {t("disclaimer.short").slice(0, 60)}…
        </span>
      ) : (
        <span style={{ flex: 1 }}>{t("disclaimer.short")}</span>
      )}

      <button
        id="disclaimer-toggle-btn"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? "הרחב" : "כווץ"}
        aria-expanded={!collapsed}
        style={{
          background: "none",
          border: "none",
          color: "#7a5c00",
          cursor: "pointer",
          fontSize: "0.8rem",
          fontWeight: 600,
          padding: "0 0.3rem",
          marginTop: 0,
          flexShrink: 0,
          opacity: 0.7,
        }}
      >
        {collapsed ? "▼" : "▲"}
      </button>
    </div>
  );
}
