"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Three clusters: write a prompt, measure a library, read the results.
// Every screen carries a one-line description so the nav explains itself.
const CLUSTERS = {
  bench: {
    key: "bench",
    label: "Bench",
    href: "/",
    blurb: "Prompt yaz, tapşırıq kitabxanası saxla, modelləri işə sal.",
    items: [
      { href: "/", label: "Playground", desc: "Bir prompt, bir neçə model, yan-yana" },
      { href: "/tasks", label: "Tapşırıqlar", desc: "Yazı tapşırıqları kitabxanası" },
      { href: "/suites", label: "Dəstlər", desc: "Bir işə salma üçün qruplaşdırılmış tapşırıqlar" },
    ],
  },
  results: {
    key: "results",
    label: "Nəticələr",
    href: "/leaderboard",
    blurb: "Modelləri müqayisə et, cavabları oxu, hakimi insan qiyməti ilə yoxla.",
    items: [
      { href: "/leaderboard", label: "Reytinq", desc: "Model üzrə ortalama ballar" },
      { href: "/runs", label: "İşə salmalar", desc: "Hər run və onun cavabları" },
      { href: "/review", label: "Kor qiymətləndirmə", desc: "Model adı gizli, insan balı" },
    ],
  },
  settings: {
    key: "settings",
    label: "Parametrlər",
    href: "/settings",
    blurb: "Provayder açarı, model siyahısı, hakim modeli və run defoltları.",
    items: [
      { href: "/settings", label: "Provayder və hakim", desc: "Nexum açarı, judge modeli" },
      { href: "/settings/models", label: "Modellər", desc: "Test edilən modellərin siyahısı" },
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
              {c.label}
            </Link>
          ))}
        </div>
        <span className="right mono">{process.env.NEXT_PUBLIC_PROVIDER_LABEL || "nexum router"}</span>
      </nav>

      <nav className="subnav" aria-label={cluster.label}>
        <span className="subnav-blurb">{cluster.blurb}</span>
        <div className="subnav-items">
          {cluster.items.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className={itemActive(path, it.href) ? "subitem active" : "subitem"}
            >
              <span className="sublabel">{it.label}</span>
              <span className="subdesc">{it.desc}</span>
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
