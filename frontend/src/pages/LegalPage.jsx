import { useLang } from "../i18n/LangContext";

export default function LegalPage({ pageKey, onClose }) {
  const { t } = useLang();
  const content = t(pageKey); // "privacy" or "terms"

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div
        style={styles.modal}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={content.title}
      >
        <div style={styles.header}>
          <h1 style={styles.title}>{content.title}</h1>
          <button
            id="legal-close-btn"
            onClick={onClose}
            style={styles.closeBtn}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p style={styles.date}>{content.lastUpdated}</p>
        <p style={styles.intro}>{content.intro}</p>

        <div style={styles.body}>
          {content.sections.map((section, i) => (
            <div key={i} style={styles.section}>
              <h2 style={styles.sectionHeading}>{section.heading}</h2>
              <p style={styles.sectionBody}>{section.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(18, 32, 43, 0.55)",
    backdropFilter: "blur(4px)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1rem",
  },
  modal: {
    background: "var(--surface)",
    borderRadius: "12px",
    maxWidth: "640px",
    width: "100%",
    maxHeight: "85vh",
    overflowY: "auto",
    padding: "2rem",
    boxShadow: "0 8px 48px rgba(0,0,0,0.18)",
    position: "relative",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "1rem",
    marginBottom: "0.5rem",
  },
  title: {
    fontSize: "1.35rem",
    fontWeight: 700,
    margin: 0,
    color: "var(--ink)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    fontSize: "1.1rem",
    cursor: "pointer",
    color: "var(--ink-soft)",
    padding: "0.2rem 0.5rem",
    marginTop: 0,
    flexShrink: 0,
  },
  date: {
    fontSize: "0.8rem",
    color: "var(--ink-soft)",
    margin: "0 0 1rem",
  },
  intro: {
    fontSize: "0.93rem",
    lineHeight: 1.65,
    color: "var(--ink)",
    borderInlineStart: "3px solid var(--accent)",
    paddingInlineStart: "0.85rem",
    margin: "0 0 1.5rem",
  },
  body: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  section: {
    borderBottom: "1px solid var(--hairline)",
    paddingBottom: "1rem",
  },
  sectionHeading: {
    fontSize: "0.95rem",
    fontWeight: 700,
    color: "var(--accent)",
    margin: "0 0 0.4rem",
    borderBottom: "none",
  },
  sectionBody: {
    fontSize: "0.9rem",
    lineHeight: 1.65,
    color: "var(--ink)",
    margin: 0,
  },
};
