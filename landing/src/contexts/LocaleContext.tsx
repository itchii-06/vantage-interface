import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { en, type LocaleData } from "../locales/en";
import { ja } from "../locales/ja";

const LANGUAGE_KEY = "LANGUAGE_KEY";

const LOCALES: Record<string, LocaleData> = { en, ja };

type Lang = "en" | "ja";

interface LocaleContextValue {
  locale: LocaleData;
  lang: Lang;
  setLang: (lang: Lang) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: en,
  lang: "en",
  setLang: () => undefined,
});

interface LocaleProviderProps {
  children: React.ReactNode;
}

export function LocaleProvider({ children }: LocaleProviderProps) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem(LANGUAGE_KEY);
    return saved === "ja" ? "ja" : "en";
  });

  const handleLangChange = useCallback((next: Lang) => {
    localStorage.setItem(LANGUAGE_KEY, next);
    setLang(next);
  }, []);

  const locale = useMemo(() => LOCALES[lang] ?? en, [lang]);

  const value = useMemo(() => ({ locale, lang, setLang: handleLangChange }), [locale, lang, handleLangChange]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  return useContext(LocaleContext);
}
