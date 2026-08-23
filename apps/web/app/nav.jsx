"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LANGS, useLang } from "@/lib/i18n";

// Three clusters: write a prompt, measure a library, read the results.
// Every screen carries a one-line description so the nav explains itself.
// Structure only — every label is resolved through the dictionary at render.
const CLUSTERS = {
  bench: {
    key: "bench",
    label: "nav.bench",
    href: "/",
    blurb: "nav.bench_blurb",
    items: [
      { href: "/", label: "nav.playground", desc: "nav.playground_desc" },
      { href: "/tasks", label: "common.tasks", desc: "nav.tasks_desc" },
      { href: "/suites", label: "nav.suites", desc: "nav.suites_desc" },
    ],
  },
  results: {
    key: "results",
    label: "nav.results",
    href: "/leaderboard",
    blurb: "nav.results_blurb",
    items: [
      { href: "/leaderboard", label: "nav.leaderboard", desc: "nav.leaderboard_desc" },
      { href: "/runs", label: "nav.runs", desc: "nav.runs_desc" },
      { href: "/review", label: "nav.review", desc: "nav.review_desc" },
    ],
  },
  settings: {
    key: "settings",
    label: "nav.settings",
    href: "/settings",
    blurb: "nav.settings_blurb",
    items: [
      { href: "/settings", label: "nav.provider_judge", desc: "nav.provider_judge_desc" },
      { href: "/settings/models", label: "common.models", desc: "nav.models_desc" },
    ],
  },
};

function itemActive(path, href) {
  if (href === "/") return path === "/";
  if (href === "/settings") return path === "/settings";
  return path === href || path.startsWith(href + "/");
}

export default function Nav() {
  const path = usePathname();
  const { lang, setLang, t } = useLang();
  const activeKey = path.startsWith("/settings")
    ? "settings"
    : path.startsWith("/leaderboard") || path.startsWith("/runs") || path.startsWith("/review")
      ? "results"
      : "bench";
  const cluster = CLUSTERS[activeKey];

  return (
    <header className="nav-wrap">
      <nav className="nav">
        <Link href="/" className="brand">
          Az<span>Test</span>
        </Link>
        <div className="tabs">
          {Object.values(CLUSTERS).map((c) => (
            <Link key={c.key} href={c.href} className={c.key === activeKey ? "tab active" : "tab"}>
              {t(c.label)}
            </Link>
          ))}
        </div>
        <div className="right">
          <div className="langswitch" role="group" aria-label={t("common.language")}>
            {Object.entries(LANGS).map(([code, label]) => (
              <button
                key={code}
                type="button"
                className={code === lang ? "active" : ""}
                aria-pressed={code === lang}
                onClick={() => setLang(code)}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="mono">{process.env.NEXT_PUBLIC_PROVIDER_LABEL || "nexum router"}</span>
        </div>
      </nav>

      <nav className="subnav" aria-label={t(cluster.label)}>
        <span className="subnav-blurb">{t(cluster.blurb)}</span>
        <div className="subnav-items">
          {cluster.items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={itemActive(path, it.href) ? "subitem active" : "subitem"}
            >
              <span className="sublabel">{t(it.label)}</span>
              <span className="subdesc">{t(it.desc)}</span>
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
