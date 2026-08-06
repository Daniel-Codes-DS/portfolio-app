import { createContext, useContext, useState, useCallback } from "react";
import en from "./en";
import he from "./he";

const STRINGS = { en, he };
const STORAGE_KEY = "portfolio_app_lang";

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(
    () => localStorage.getItem(STORAGE_KEY) || "en"
  );

  const setLang = useCallback((newLang) => {
    localStorage.setItem(STORAGE_KEY, newLang);
    setLangState(newLang);
    // Update document direction + language immediately
    document.documentElement.setAttribute("dir", newLang === "he" ? "rtl" : "ltr");
    document.documentElement.setAttribute("lang", newLang);
    document.title = STRINGS[newLang].appName;
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === "en" ? "he" : "en");
  }, [lang, setLang]);

  // t("dashboard.title") → string from active language
  const t = useCallback(
    (keyPath) => {
      const parts = keyPath.split(".");
      let node = STRINGS[lang];
      for (const p of parts) {
        if (node == null) return keyPath;
        node = node[p];
      }
      return node ?? keyPath;
    },
    [lang]
  );

  const dir = lang === "he" ? "rtl" : "ltr";
  const locale = lang === "he" ? "he-IL" : "en-US";

  return (
    <LangContext.Provider value={{ lang, setLang, toggleLang, t, dir, locale }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error("useLang must be used inside <LangProvider>");
  return ctx;
}
