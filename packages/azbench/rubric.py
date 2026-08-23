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
        "label_en": "Orthography & diacritics",
        "weight": 0.20,
        "guide": "Hərf və diakritika səhvləri (ə, ğ, ı, ö, ş, ü, ç), böyük/kiçik hərf, durğu işarələri.",
        "guide_en": "Letter and diacritic errors (ə, ğ, ı, ö, ş, ü, ç), capitalisation, punctuation.",
    },
    {
        "key": "qrammatika",
        "en": "Grammar",
        "label": "Qrammatika və morfologiya",
        "label_en": "Grammar & morphology",
        "weight": 0.22,
        "guide": "Hal şəkilçiləri, mənsubiyyət, uzlaşma, zaman, söz sırası, cümlə quruluşu.",
        "guide_en": "Case suffixes, possession, agreement, tense, word order, sentence structure.",
    },
    {
        "key": "tebiilik",
        "en": "Naturalness",
        "label": "Təbiilik və axıcılıq",
        "label_en": "Naturalness & fluency",
        "weight": 0.20,
        "guide": "Ana dili daşıyıcısı belə yazardımı? Tərcümə qoxusu, süni konstruksiyalar, kalka cümlələr.",
        "guide_en": "Would a native writer write this? Translationese, contrived phrasing, calqued sentences.",
    },
    {
        "key": "leksika",
        "en": "Lexis & terminology",
        "label": "Leksika və terminologiya",
        "label_en": "Lexis & terminology",
        "weight": 0.16,
        "guide": "Söz seçimi, sahə terminlərinin düzgünlüyü, lüzumsuz rusizm/türkizm, anqlisizm.",
        "guide_en": "Word choice, correct domain terms, needless russianisms/turkisms, anglicisms.",
    },
    {
        "key": "uslub",
        "en": "Register",
        "label": "Üslub və registr",
        "label_en": "Style & register",
        "weight": 0.10,
        "guide": "Tapşırığın tələb etdiyi rəsmi/neytral/danışıq registrinə uyğunluq, ton.",
        "guide_en": "Fit to the formal/neutral/colloquial register the task asked for, and tone.",
    },
    {
        "key": "uygunluq",
        "en": "Task compliance",
        "label": "Tapşırığa uyğunluq",
        "label_en": "Task compliance",
        "weight": 0.12,
        "guide": "Tapşırıq tam yerinə yetirilibmi: məzmun, uzunluq, format, tələb olunan bəndlər.",
        "guide_en": "Was the task fully carried out: content, length, format, required elements.",
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
