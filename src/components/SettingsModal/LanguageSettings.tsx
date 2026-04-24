import { t } from "@lingui/macro";
import { useLingui } from "@lingui/react";

import { dynamicActivate, locales } from "lib/i18n";

import { SettingsSection } from "./shared";

export function LanguageSettings() {
  const { i18n } = useLingui();
  const currentLocale = i18n.locale;

  return (
    <div className="flex flex-col gap-16 font-medium">
      <SettingsSection>
        <div className="text-body-small text-typography-secondary">{t`Select your preferred language`}</div>
        <div className="flex flex-col gap-4">
          {Object.entries(locales).map(([locale, label]) => {
            const isActive = locale === currentLocale;
            return (
              <button
                key={locale}
                onClick={() => dynamicActivate(locale)}
                className={`text-body-medium flex items-center justify-between rounded-8 px-12 py-10 transition-colors ${
                  isActive
                    ? "bg-fill-surfaceActive text-typography-primary"
                    : "hover:bg-fill-surfaceElevated100 text-typography-secondary hover:text-typography-primary"
                }`}
              >
                <span>{label}</span>
                {isActive && <span className="h-8 w-8 rounded-full bg-[#ecff3e]" />}
              </button>
            );
          })}
        </div>
      </SettingsSection>
    </div>
  );
}
