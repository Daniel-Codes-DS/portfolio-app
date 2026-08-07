import { useState } from "react";
import { useLang } from "../i18n/LangContext";
import LegalPage from "../pages/LegalPage";

export default function Footer() {
  const { t } = useLang();
  const [modal, setModal] = useState(null); // "privacy" | "terms" | null

  const year = new Date().getFullYear();

  return (
    <>
      <footer style={styles.footer}>
        <span style={styles.rights}>
          © {year} {t("appName")} — {t("footer.rights")}
        </span>

        <div style={styles.links}>
          <button
            id="footer-privacy-btn"
            style={styles.link}
            onClick={() => setModal("privacy")}
          >
            {t("footer.privacy")}
          </button>

          <span style={styles.sep} aria-hidden="true">·</span>

          <button
            id="footer-terms-btn"
            style={styles.link}
            onClick={() => setModal("terms")}
          >
            {t("footer.terms")}
          </button>
        </div>
      </footer>

      {modal && (
        <LegalPage
          pageKey={modal}
          onClose={() => setModal(null)}
        />
      )}
    </>
  );
}

const styles = {
  footer: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem 1.5rem",
    padding: "1.5rem 2rem",
    marginTop: "auto",
    borderTop: "1px solid var(--hairline)",
    fontSize: "0.8rem",
    color: "var(--ink-soft)",
  },
  rights: {
    opacity: 0.75,
  },
  links: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  link: {
    background: "none",
    border: "none",
    color: "var(--accent)",
    cursor: "pointer",
    fontSize: "0.8rem",
    fontWeight: 500,
    padding: 0,
    marginTop: 0,
    textDecoration: "underline",
    textUnderlineOffset: "2px",
  },
  sep: {
    color: "var(--hairline)",
    userSelect: "none",
  },
};
