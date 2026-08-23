"""Self-contained A4 report for an external audience.

One HTML file, no external assets, print CSS that paginates properly — so it
can be emailed, hosted anywhere, or printed to PDF without the app.

Two rules shape the content:
  1. Say how the numbers were produced, before showing them. A leaderboard
     without its method is not evidence.
  2. Never hide what could not be scored. A model with two usable answers out
     of six is not comparable to one with six, so exclusions are reported
     beside the scores rather than dropped.
"""

from __future__ import annotations

import html
from datetime import datetime, timezone

from azbench.rubric import DIMENSIONS

_ESC = html.escape


def _n(value, digits: int = 1, dash: str = "—") -> str:
    if value is None:
        return dash
    try:
        number = float(value)
    except (TypeError, ValueError):
        return _ESC(str(value))
    return f"{number:.{digits}f}" if digits else f"{number:.0f}"


def _tier(score) -> str:
    if score is None:
        return "none"
    value = float(score)
    return "good" if value >= 75 else "mid" if value >= 50 else "bad"


CSS = """
:root {
  --ink: #0f1b2d; --ink-2: #4a5a6e; --ink-3: #8595a8;
  --border: #dde5f1; --surface-2: #f6f8fc;
  --accent: #2563eb; --good: #16a34a; --warning: #d97706; --serious: #e11d48;
  --mono: ui-monospace, "SF Mono", Menlo, monospace;
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: #eef1f6; color: var(--ink);
  font: 10.5pt/1.55 system-ui, -apple-system, "Segoe UI", sans-serif;
  -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
.sheet {
  width: 210mm; min-height: 297mm; margin: 10mm auto; padding: 18mm 16mm;
  background: #fff; box-shadow: 0 2px 18px rgba(20,38,58,.16);
}
h1 { font-size: 21pt; margin: 0 0 4pt; letter-spacing: -.01em; }
h2 {
  font-size: 12.5pt; margin: 20pt 0 7pt; padding-bottom: 3pt;
  border-bottom: 1.5px solid var(--accent);
}
h3 { font-size: 10.5pt; margin: 13pt 0 5pt; color: var(--ink-2); }
p { margin: 0 0 6pt; }
.lede { color: var(--ink-2); font-size: 11pt; max-width: 62ch; }
.eyebrow {
  font-family: var(--mono); font-size: 8pt; text-transform: uppercase;
  letter-spacing: .16em; color: var(--accent); margin-bottom: 6pt;
}
.meta {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 2pt 18pt;
  border: 1px solid var(--border); border-radius: 4pt; padding: 8pt 11pt;
  margin: 12pt 0 4pt; font-size: 9.5pt;
}
.meta div { display: flex; justify-content: space-between; gap: 10pt;
  padding: 2pt 0; border-bottom: 1px solid var(--surface-2); }
.meta div:last-child, .meta div:nth-last-child(2) { border-bottom: none; }
.meta .k { color: var(--ink-3); }
.meta .v { font-weight: 600; text-align: right; }
.tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8pt; margin: 12pt 0; }
.tile { border: 1px solid var(--border); border-radius: 4pt; padding: 8pt 10pt; }
.tile .label { font-size: 7.5pt; text-transform: uppercase; letter-spacing: .09em; color: var(--ink-3); }
.tile .value { font-size: 17pt; font-weight: 650; line-height: 1.2; font-variant-numeric: tabular-nums; }
.tile .sub { font-size: 8pt; color: var(--ink-2); }
table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 6pt 0 4pt; }
th { text-align: left; font-size: 7.5pt; text-transform: uppercase; letter-spacing: .08em;
  color: var(--ink-3); font-weight: 600; padding: 5pt 6pt; border-bottom: 1.2px solid var(--border); }
td { padding: 5pt 6pt; border-bottom: 1px solid var(--surface-2); vertical-align: top; }
tr:last-child td { border-bottom: none; }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.mono { font-family: var(--mono); font-size: 9pt; }
.dim { color: var(--ink-3); }
.muted { color: var(--ink-2); }
.rank { font-family: var(--mono); color: var(--ink-3); }
.rank.top { color: var(--accent); font-weight: 700; }
.score { font-weight: 650; font-variant-numeric: tabular-nums; }
.score.good { color: var(--good); } .score.mid { color: var(--warning); }
.score.bad { color: var(--serious); } .score.none { color: var(--ink-3); font-weight: 400; }
.bar { display: inline-block; width: 46pt; height: 4pt; border-radius: 2pt;
  background: var(--surface-2); overflow: hidden; vertical-align: middle; margin-left: 5pt; }
.bar i { display: block; height: 100%; background: var(--accent); }
.bar i.good { background: var(--good); } .bar i.mid { background: var(--warning); }
.bar i.bad { background: var(--serious); }
.note {
  border: 1px solid var(--border); border-left: 3px solid var(--warning);
  background: #fffdf7; border-radius: 0 4pt 4pt 0; padding: 8pt 11pt;
  font-size: 9.5pt; color: var(--ink-2); margin: 9pt 0;
}
.note strong { color: var(--ink); }
.rubric td.w { text-align: right; font-variant-numeric: tabular-nums; width: 8%; }
.quote { border-left: 2px solid var(--serious); padding-left: 7pt; margin: 4pt 0 8pt; font-size: 9.5pt; }
.quote .bad { color: var(--serious); text-decoration: line-through; }
.quote .arrow { color: var(--ink-3); margin: 0 4pt; }
.quote .fix { color: var(--good); font-weight: 600; }
.quote .who { display: block; font-family: var(--mono); font-size: 8pt; color: var(--ink-3); margin-bottom: 2pt; }
.sample { border: 1px solid var(--border); border-radius: 4pt; padding: 9pt 11pt; margin: 7pt 0; }
.sample header { display: flex; justify-content: space-between; gap: 10pt;
  font-size: 8.5pt; color: var(--ink-3); margin-bottom: 5pt; }
.sample .body { white-space: pre-wrap; font-size: 9.5pt; line-height: 1.5; }
footer { margin-top: 18pt; padding-top: 7pt; border-top: 1px solid var(--border);
  font-size: 8pt; color: var(--ink-3); display: flex; justify-content: space-between; }
.avoid { break-inside: avoid; page-break-inside: avoid; }

@media print {
  @page { size: A4; margin: 16mm 14mm; }
  body { background: #fff; font-size: 10pt; }
  .sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
  h2 { break-after: avoid; page-break-after: avoid; }
  table { break-inside: auto; }
  thead { display: table-header-group; }
  tr, .tile, .note, .sample, .quote { break-inside: avoid; page-break-inside: avoid; }
  .no-print { display: none; }
}
"""

PRINT_HINT = (
    '<p class="no-print dim" style="text-align:center;font-size:9pt;margin:0 0 6pt">'
    "Bu səhifə A4 formatına uyğundur — brauzerdə Çap (Ctrl/Cmd+P) ilə PDF kimi "
    "saxlaya bilərsiniz.</p>"
)


def _score_cell(value) -> str:
    tier = _tier(value)
    if value is None:
        return '<td class="num"><span class="score none">—</span></td>'
    width = max(0.0, min(100.0, float(value)))
    return (
        f'<td class="num"><span class="score {tier}">{_n(value)}</span>'
        f'<span class="bar"><i class="{tier}" style="width:{width:.0f}%"></i></span></td>'
    )


def render_report(
    *,
    title: str,
    scope: dict,
    rows: list[dict],
    dimensions: dict,
    errors: list[dict],
    excluded: list[dict],
    samples: list[dict],
    agreement: dict | None,
    generated_at: datetime | None = None,
) -> str:
    """Return one standalone HTML document."""
    when = (generated_at or datetime.now(timezone.utc)).strftime("%d.%m.%Y %H:%M UTC")
    scored = sum(int(r["generations"]) for r in rows)
    best = rows[0] if rows else None
    judged = [r for r in rows if r.get("judge_score") is not None]
    average = sum(float(r["judge_score"]) for r in judged) / len(judged) if judged else None
    total_excluded = sum(int(x["excluded"]) for x in excluded)
    has_human = any(r.get("human_ratings") for r in rows)

    parts: list[str] = [
        "<!doctype html><html lang=\"az\"><head><meta charset=\"utf-8\">",
        '<meta name="viewport" content="width=device-width, initial-scale=1">',
        f"<title>{_ESC(title)}</title><style>{CSS}</style></head><body>",
        PRINT_HINT,
        '<div class="sheet">',
        '<div class="eyebrow">AzTest — dil modellərinin qiymətləndirilməsi</div>',
        f"<h1>{_ESC(title)}</h1>",
        '<p class="lede">Bu hesabat dil modellərinin Azərbaycan dilində yazı '
        "keyfiyyətini üç müstəqil ölçmə qatı ilə müqayisə edir: deterministik "
        "mexaniki yoxlamalar, LLM-hakim qiyməti və kor insan qiyməti.</p>",
        '<div class="meta">',
    ]
    for key, value in scope.items():
        parts.append(f'<div><span class="k">{_ESC(key)}</span>'
                     f'<span class="v">{_ESC(str(value))}</span></div>')
    parts.append(f'<div><span class="k">Hesabat tarixi</span><span class="v">{when}</span></div>')
    parts.append("</div>")

    # ---- headline numbers ----
    parts += [
        '<div class="tiles">',
        f'<div class="tile"><div class="label">Model</div><div class="value">{len(rows)}</div>'
        '<div class="sub">müqayisə edilən</div></div>',
        f'<div class="tile"><div class="label">Qiymətlənən cavab</div><div class="value">{scored}</div>'
        f'<div class="sub">{total_excluded} cavab kənarda</div></div>',
        f'<div class="tile"><div class="label">Orta bal</div><div class="value">{_n(average)}</div>'
        '<div class="sub">hakim, 0–100</div></div>',
        f'<div class="tile"><div class="label">Ən yüksək</div>'
        f'<div class="value">{_n(best["judge_score"]) if best else "—"}</div>'
        f'<div class="sub mono">{_ESC(best["model_id"]) if best else "—"}</div></div>',
        "</div>",
    ]

    if not has_human:
        parts.append(
            '<div class="note"><strong>Metodoloji qeyd:</strong> bu hesabatda insan '
            "qiyməti yoxdur, ona görə hakim balı <em>kalibrlənməmişdir</em>. LLM-hakim "
            "öz ailəsindən olan modellərə meyl göstərə bilər. Bal fərqləri kiçik olduqda "
            "(təxminən 5 baldan az) onları həlledici saymaq olmaz.</div>"
        )

    # ---- method, before the numbers it produced ----
    parts += [
        "<h2>Metodologiya</h2>",
        "<h3>1. Mexaniki yoxlamalar (deterministik, modelsiz)</h3>",
        '<p class="muted">Hər cavab proqram vasitəsilə yoxlanılır: diakritikanın '
        "buraxılması (ə, ğ, ı, ö, ş, ü, ç), kiril və ya ərəb qrafikasının sızması, "
        "Azərbaycan dilində fərqli olan Türkiyə türkcəsi formaları (<span class='mono'>"
        "değil→deyil</span>, <span class='mono'>için→üçün</span>), danışıq rusizmləri, "
        "təkrarlanan mətn və görünməyən simvollar. Hər tapıntı sitatla göstərilir. "
        "Bunlar evristikadır — qiymət deyil, yoxlanılası siqnaldır.</p>",
        "<h3>2. LLM-hakim (rubrika üzrə)</h3>",
        '<p class="muted">Hakim modelə Azərbaycan dilində göstəriş verilir və hər cavabı '
        "altı meyar üzrə 1–5 balla qiymətləndirir, konkret səhvləri sitat və düzəlişlə "
        "qaytarır. Ümumi bal çəkili ortadır (0–100).</p>",
        '<table class="rubric"><thead><tr><th>Meyar</th><th class="w">Çəki</th>'
        "<th>Nəyə baxılır</th></tr></thead><tbody>",
    ]
    for d in DIMENSIONS:
        parts.append(
            f'<tr><td><strong>{_ESC(d["label"])}</strong></td>'
            f'<td class="w">{d["weight"]:.2f}</td>'
            f'<td class="muted">{_ESC(d["guide"])}</td></tr>'
        )
    parts += [
        "</tbody></table>",
        "<h3>3. Kor insan qiyməti</h3>",
        '<p class="muted">Eyni rubrika ilə insan qiymətləndirir; model adı gizlədilir. '
        "Hakimin etibarlılığı yalnız bununla yoxlanıla bilər.</p>",
    ]

    # ---- results ----
    parts += [
        "<h2>Nəticələr</h2>",
        '<table><thead><tr><th>#</th><th>Model</th><th class="num">Hakim balı</th>'
        '<th class="num">Mexanika</th><th class="num">İnsan balı</th>'
        '<th class="num">Cavab</th><th class="num">Orta gecikmə</th>'
        '<th class="num">Orta token</th></tr></thead><tbody>',
    ]
    for i, r in enumerate(rows, start=1):
        latency = r.get("avg_latency_ms")
        latency_txt = f"{float(latency)/1000:.1f}s" if latency else "—"
        human = (
            f'{_n(r["human_score"])} <span class="dim">(n={r["human_ratings"]})</span>'
            if r.get("human_ratings") else '<span class="dim">—</span>'
        )
        parts.append(
            f'<tr><td class="rank{" top" if i == 1 else ""}">{i}</td>'
            f'<td class="mono">{_ESC(r["model_id"])}</td>'
            f'{_score_cell(r.get("judge_score"))}'
            f'{_score_cell(r.get("mechanics_score"))}'
            f'<td class="num">{human}</td>'
            f'<td class="num">{r["generations"]}</td>'
            f'<td class="num dim">{latency_txt}</td>'
            f'<td class="num dim">{_n(r.get("avg_output_tokens"), 0)}</td></tr>'
        )
    parts.append("</tbody></table>")

    # ---- per-dimension ----
    if dimensions:
        parts += [
            "<h2>Meyarlar üzrə orta bal (1–5)</h2>",
            '<p class="muted">Ümumi balı yaxın olan modellər burada ayrılır: biri '
            "orfoqrafiyada, digəri təbiilikdə uduzur.</p>",
            "<table><thead><tr><th>Model</th>"
            + "".join(f'<th class="num">{_ESC(d["en"])}</th>' for d in DIMENSIONS)
            + "</tr></thead><tbody>",
        ]
        for model, scores in dimensions.items():
            cells = []
            for d in DIMENSIONS:
                value = scores.get(d["key"])
                if value is None:
                    cells.append('<td class="num dim">—</td>')
                else:
                    colour = ("good" if value >= 4 else "mid" if value >= 3 else "bad")
                    cells.append(f'<td class="num"><span class="score {colour}">{value:.2f}</span></td>')
            parts.append(f'<tr><td class="mono">{_ESC(model)}</td>{"".join(cells)}</tr>')
        parts.append("</tbody></table>")

    # ---- exclusions: never silently dropped ----
    if excluded:
        parts += [
            "<h2>Qiymətləndirilə bilməyən cavablar</h2>",
            '<p class="muted">Bu cavablar reytinqə daxil edilmir. Onları gizlətmək '
            "əhatəni şişirdərdi: altı tapşırıqdan ikisini cavablandıran model altısını "
            "cavablandıranla müqayisə oluna bilməz.</p>",
            '<table><thead><tr><th>Model</th><th class="num">Say</th>'
            '<th class="num">Token həddində kəsilən</th><th>Səbəb (nümunə)</th>'
            "</tr></thead><tbody>",
        ]
        for x in excluded:
            parts.append(
                f'<tr><td class="mono">{_ESC(x["model_id"])}</td>'
                f'<td class="num">{x["excluded"]}</td>'
                f'<td class="num">{x["truncated"]}</td>'
                f'<td class="muted">{_ESC((x.get("example") or "")[:150])}</td></tr>'
            )
        parts.append("</tbody></table>")

    # ---- error taxonomy ----
    if errors:
        parts += [
            "<h2>Ən çox rast gəlinən səhv tipləri</h2>",
            '<table><thead><tr><th>Tip</th><th class="num">Say</th></tr></thead><tbody>',
        ]
        for e in errors:
            parts.append(
                f'<tr><td>{_ESC(str(e["error_type"]))}</td>'
                f'<td class="num">{e["hits"]}</td></tr>'
            )
        parts.append("</tbody></table>")

    # ---- concrete evidence ----
    if samples:
        parts.append("<h2>Nümunələr</h2>")
        for s in samples:
            parts.append('<div class="sample avoid"><header>'
                         f'<span class="mono">{_ESC(s["model_id"])}</span>'
                         f'<span>{_ESC(s["task_code"])} · '
                         f'{"bal " + _n(s["score"]) if s.get("score") is not None else "qiymətsiz"}</span>'
                         "</header>"
                         f'<div class="body">{_ESC(s["excerpt"])}</div>')
            for err in s.get("errors", [])[:3]:
                parts.append(
                    '<div class="quote">'
                    f'<span class="who">{_ESC(err.get("issue", ""))}</span>'
                    f'<span class="bad">{_ESC(err.get("quote", ""))}</span>'
                    f'<span class="arrow">→</span>'
                    f'<span class="fix">{_ESC(err.get("fix", ""))}</span></div>'
                )
            parts.append("</div>")

    # ---- agreement ----
    if agreement and agreement.get("pairs"):
        parts += [
            "<h2>Hakim ↔ insan uyğunluğu</h2>",
            '<div class="meta">'
            f'<div><span class="k">Müqayisə edilən cüt</span>'
            f'<span class="v">{agreement["pairs"]}</span></div>'
            f'<div><span class="k">Orta fərq |hakim − insan|</span>'
            f'<span class="v">{_n(agreement.get("mean_abs_diff"))}</span></div>'
            f'<div><span class="k">Hakimin ortası</span>'
            f'<span class="v">{_n(agreement.get("judge_mean"))}</span></div>'
            f'<div><span class="k">İnsanın ortası</span>'
            f'<span class="v">{_n(agreement.get("human_mean"))}</span></div>'
            "</div>",
        ]

    # ---- limits, stated rather than implied ----
    parts += [
        "<h2>Məhdudiyyətlər</h2>",
        '<ul class="muted" style="margin:0;padding-left:14pt">',
        "<li>Mexaniki yoxlamalar evristikadır: qısa mətnlərdə diakritika ölçüsü "
        "işləmir, türkcə və rusizm siyahıları qısadır və məqsədli seçilmişdir.</li>",
        "<li>LLM-hakim öz ailəsindən olan modellərə meyl göstərə bilər; kor insan "
        "qiyməti olmadan bu meyl ölçülməmiş qalır.</li>",
        "<li>Provayder sabit tarifli olduğuna görə token qiymətləri əl ilə təyin "
        "edilir; qiymət göstərilməyibsə xərc sıfır kimi görünür.</li>",
        "<li>Nəticələr yalnız bu hesabatda göstərilən tapşırıqlara aiddir və "
        "ümumi model keyfiyyəti barədə yekun hökm deyil.</li>",
        "</ul>",
        '<footer><span>AzTest — Azərbaycan dili üzrə LLM benchmark</span>'
        f"<span>{when}</span></footer>",
        "</div></body></html>",
    ]
    return "".join(parts)
