/**
 * AppNav.tsx
 *
 * Shared left-side navigation used across all Vantage pages.
 * Pass as <AppHeader leftContent={<AppNav />} />.
 *
 * Menu: Logo | Hedge | Trade | Vaults | Portfolio | More ▾ (Stats / Docs)
 */

import { msg, t } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import ChevronDownIcon from "img/ic_chevron_down.svg?react";
import logoIcon from "img/logo-w.svg";

// TODO: Replace with the production documentation URL before launch
const DOCS_URL = "https://docs.vantage.finance";

const NAV_ITEMS = [
  { key: "hedge", label: msg`Hedge`, to: "/hedge" },
  { key: "trade", label: msg`Trade`, to: "/trade" },
  { key: "vaults", label: msg`Vaults`, to: "/vaults" },
  { key: "portfolio", label: msg`Portfolio`, to: "/portfolio" },
  { key: "status", label: msg`Status`, to: "/status" },
] as const;

export function AppNav() {
  const { pathname } = useLocation();
  const { _ } = useLingui();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex items-center gap-24">
      <Link to="/" className="flex items-center gap-8 pl-4">
        <img src={logoIcon} alt="Logo" className="w-88" />
      </Link>

      <nav className="flex items-center">
        {NAV_ITEMS.map(({ key, label, to }) => {
          const isActive = pathname === to || pathname.startsWith(`${to}/`);
          return (
            <Link
              key={key}
              to={to}
              className={`px-14 py-8 text-16 font-medium transition-colors ${
                isActive ? "text-white" : "text-vantage-text-secondary hover:text-white"
              }`}
            >
              {_(label)}
            </Link>
          );
        })}

        {/* More dropdown */}
        <div className="relative" ref={moreRef}>
          <button
            onClick={() => setIsMoreOpen((o) => !o)}
            className={`flex items-center gap-4 px-14 py-8 text-16 font-medium transition-colors ${
              isMoreOpen ? "text-white" : "text-vantage-text-secondary hover:text-white"
            }`}
          >
            {t`More`}
            <ChevronDownIcon className={`w-12 transition-transform duration-200 ${isMoreOpen ? "rotate-180" : ""}`} />
          </button>

          {isMoreOpen && (
            <>
              {/* Backdrop — closes dropdown on outside click */}
              <div className="fixed inset-0 z-40" onClick={() => setIsMoreOpen(false)} />

              <div className="black absolute left-0 top-full z-50 mt-4 min-w-[160px] overflow-hidden rounded-4 border border-stroke-primary shadow-xl">
                <a
                  href={DOCS_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-16 py-10 text-16 text-slate-400 transition-colors hover:bg-slate-800/50 hover:text-white"
                >
                  {t`Docs`}
                </a>
              </div>
            </>
          )}
        </div>
      </nav>
    </div>
  );
}
