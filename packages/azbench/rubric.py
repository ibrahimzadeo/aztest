"""The Azerbaijani writing rubric — the single source of truth for both the
LLM judge and the human review screen, so the two are directly comparable."""

from __future__ import annotations

# Each dimension is scored 1-5. `weight` feeds the 0-100 overall score.
# Labels are Azerbaijani (the raters and the judge both work in AZ); `en`
# is there for the operator reading the UI in English.
DIMENSIONS = [
    {
        "key": "orfoqrafiya",
        "en": "Orthography",
        "label": "Orfoqrafiya və diakritika",
        "weight": 0.20,
        "guide": "Hərf və diakritika səhvləri (ə, ğ, ı, ö, ş, ü, ç), böyük/kiçik hərf, durğu işarələri.",
    },
    {
        "key": "qrammatika",
        "en": "Grammar",
        "label": "Qrammatika və morfologiya",
        "weight": 0.22,
        "guide": "Hal şəkilçiləri, mənsubiyyət, uzlaşma, zaman, söz sırası, cümlə quruluşu.",
    },
    {
        "key": "tebiilik",
        "en": "Naturalness",
        "label": "Təbiilik və axıcılıq",
        "weight": 0.20,
        "guide": "Ana dili daşıyıcısı belə yazardımı? Tərcümə qoxusu, süni konstruksiyalar, kalka cümlələr.",
    },
    {
        "key": "leksika",
        "en": "Lexis & terminology",
        "label": "Leksika və terminologiya",
        "weight": 0.16,
        "guide": "Söz seçimi, sahə terminlərinin düzgünlüyü, lüzumsuz rusizm/türkizm, anqlisizm.",
    },
    {
        "key": "uslub",
        "en": "Register",
        "label": "Üslub və registr",
        "weight": 0.10,
        "guide": "Tapşırığın tələb etdiyi rəsmi/neytral/danışıq registrinə uyğunluq, ton.",
    },
    {
        "key": "uygunluq",
        "en": "Task compliance",
        "label": "Tapşırığa uyğunluq",
        "weight": 0.12,
        "guide": "Tapşırıq tam yerinə yetirilibmi: məzmun, uzunluq, format, tələb olunan bəndlər.",
    },
]

DIMENSION_KEYS = [d["key"] for d in DIMENSIONS]
WEIGHTS = {d["key"]: d["weight"] for d in DIMENSIONS}


def overall(scores: dict) -> float | None:
    """Weighted 0-100 from 1-5 dimension scores. Missing dimensions are
    dropped and the remaining weights renormalised, so a partial score is
    still comparable rather than silently deflated."""
    used = {k: float(v) for k, v in (scores or {}).items() if k in WEIGHTS and v is not None}
    if not used:
        return None
    total_w = sum(WEIGHTS[k] for k in used)
    weighted = sum(WEIGHTS[k] * used[k] for k in used) / total_w
    return round((weighted - 1) / 4 * 100, 1)
