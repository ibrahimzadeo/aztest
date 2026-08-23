"""Deterministic Azerbaijani-text checks.

These are cheap heuristics, not a grader. They run on every generation for
free and are meant to catch the mechanical failures an LLM judge is bad at
noticing: stripped diacritics, Cyrillic leakage, Turkish forms standing in
for Azerbaijani ones, and degenerate repetition. Every signal is reported
with its evidence so a human can dismiss a false positive.
"""

from __future__ import annotations

import re
import unicodedata

# Azerbaijani Latin alphabet (32 letters). `w` is NOT in it.
AZ_ALPHABET = set("abcçdeəfgğhxıijkqlmnoöprsştuüvyz")
# The six letters that only Azerbaijani orthography carries in quantity.
# Turkish has ç ğ ı ö ş ü but never ə or (in native words) q/x.
AZ_SPECIFIC = set("əğıöşüç")
AZ_UNIQUE = set("ə")

CYRILLIC = re.compile(r"[Ѐ-ӿ]")
NON_AZ_LATIN = re.compile(r"[wWœ]")
ARABIC = re.compile(r"[؀-ۿ]")

# Turkish forms whose Azerbaijani equivalent is a different word or spelling.
# Curated and deliberately short — a hit is a flag for review, not a verdict.
TURKISH_FORMS = {
    "değil": "deyil",
    "değildir": "deyildir",
    "için": "üçün",
    "gibi": "kimi",
    "şey": "şey (AZ: şey ok, but check register)",
    "nasıl": "necə",
    "şimdi": "indi",
    "çünkü": "çünki",
    "hepsi": "hamısı",
    "yapmak": "etmək",
    "yapıyor": "edir",
    "ediyor": "edir",
    "olduğu": "olduğu (TR spelling of AZ olduğu — check ğ/y)",
    "büyük": "böyük",
    "küçük": "kiçik",
    "güzel": "gözəl",
    "iyi": "yaxşı",
    "kişi": "şəxs",
    "hangi": "hansı",
    "böyle": "belə",
    "şöyle": "elə",
    "hemen": "dərhal",
    "ancak": "lakin",
    "sadece": "yalnız",
    "gerçekten": "həqiqətən",
    "önemli": "əhəmiyyətli",
    "yeni": "yeni (ok)",
    "değişiklik": "dəyişiklik",
    "geliştirme": "inkişaf",
    "kullanıcı": "istifadəçi",
    "bilgi": "məlumat",
    "sonuç": "nəticə",
    "ilgili": "aid",
    "üzerinde": "üzərində",
    "yılında": "ilində",
    "yıl": "il",
    "hafta": "həftə (ok)",
    "olarak": "olaraq (ok, TR-leaning)",
}

# Colloquial Russian borrowings that read as unedited speech in written AZ.
RUSSIAN_COLLOQUIAL = [
    "srazu", "voobşe", "vabşe", "konkret", "normalno", "davay", "paka",
    "obşi", "primer olaraq", "voprosu", "problema yoxdur", "vseravno",
    "vse ravno", "kaneşno", "koneşno", "tak ki", "znaçit", "vot",
]

# Words that are correct only with diacritics — if the text spells them
# bare-ASCII, the model (or its pipeline) stripped the diacritics.
STRIPPED_MARKERS = {
    "ve": "və", "ucun": "üçün", "olcu": "ölçü", "sirket": "şirkət",
    "musteri": "müştəri", "mehsul": "məhsul",
    "isci": "işçi", "gore": "görə", "olke": "ölkə", "muddet": "müddət",
    "boyuk": "böyük", "kicik": "kiçik",
    "yaxsi": "yaxşı", "duzgun": "düzgün", "mumkun": "mümkün",
    "elaqe": "əlaqə", "muraciet": "müraciət", "hemcinin": "həmçinin",
    "eger": "əgər", "chox": "çox", "cox": "çox", "isleyir": "işləyir",
}

WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)
SENT_RE = re.compile(r"[.!?…]+\s|[.!?…]+$")


def _words(text: str) -> list[str]:
    return WORD_RE.findall(text.lower())


def _letters(text: str) -> str:
    return "".join(ch for ch in text.lower() if ch.isalpha())


def run_checks(text: str) -> dict:
    """Return a signal dict: metrics, flags (each with evidence), and a
    0-100 `mechanics_score` that only ever penalises hard evidence."""
    text = text or ""
    words = _words(text)
    letters = _letters(text)
    n_words = len(words)
    n_letters = len(letters) or 1

    az_specific_count = sum(1 for ch in letters if ch in AZ_SPECIFIC)
    az_specific_ratio = az_specific_count / n_letters
    schwa_count = letters.count("ə")

    sentences = [s for s in SENT_RE.split(text) if s and s.strip()]
    n_sent = len(sentences) or (1 if text.strip() else 0)

    flags: list[dict] = []

    if not text.strip():
        flags.append({"code": "empty", "severity": "critical", "detail": "model returned no text"})

    cyr = CYRILLIC.findall(text)
    if cyr:
        flags.append({
            "code": "cyrillic_leakage",
            "severity": "high",
            "detail": f"{len(cyr)} Cyrillic character(s)",
            "evidence": "".join(sorted(set(cyr))[:20]),
        })

    arabic = ARABIC.findall(text)
    if arabic:
        flags.append({
            "code": "arabic_script",
            "severity": "high",
            "detail": f"{len(arabic)} Arabic-script character(s)",
            "evidence": "".join(sorted(set(arabic))[:20]),
        })

    non_az = NON_AZ_LATIN.findall(text)
    if non_az:
        flags.append({
            "code": "non_az_letter",
            "severity": "low",
            "detail": f"letter(s) outside the Azerbaijani alphabet: {sorted(set(non_az))}",
            "evidence": "".join(sorted(set(non_az))),
        })

    # Diacritics: real Azerbaijani prose runs ~8-14% AZ-specific letters and
    # always carries ə. Measured on clean AZ prose the ratio sits ~0.15-0.30;
    # near-zero over a substantial text means stripped or wrong language.
    if n_letters > 120 and schwa_count == 0:
        flags.append({
            "code": "no_schwa",
            "severity": "high",
            "detail": "no 'ə' in a substantial text — diacritics likely stripped or not Azerbaijani",
        })
    if n_letters > 120 and az_specific_ratio < 0.07:
        flags.append({
            "code": "low_diacritic_density",
            "severity": "medium",
            "detail": f"AZ-specific letters are {az_specific_ratio:.1%} of letters (clean AZ prose runs 15-30%)",
        })

    stripped_hits = sorted({w for w in words if w in STRIPPED_MARKERS})
    if stripped_hits:
        flags.append({
            "code": "ascii_spelling",
            "severity": "medium",
            "detail": "words spelled without their diacritics",
            "evidence": ", ".join(f"{w} → {STRIPPED_MARKERS[w]}" for w in stripped_hits[:12]),
        })

    tr_hits = sorted({w for w in words if w in TURKISH_FORMS})
    if tr_hits:
        flags.append({
            "code": "turkish_form",
            "severity": "medium",
            "detail": "Turkish forms where Azerbaijani differs",
            "evidence": ", ".join(f"{w} → {TURKISH_FORMS[w]}" for w in tr_hits[:12]),
        })

    low = " " + text.lower() + " "
    ru_hits = [p for p in RUSSIAN_COLLOQUIAL if f" {p} " in low or f" {p}," in low]
    if ru_hits:
        flags.append({
            "code": "russian_colloquial",
            "severity": "low",
            "detail": "colloquial Russian borrowings in written text",
            "evidence": ", ".join(ru_hits[:10]),
        })

    rep = _repetition(words)
    if rep["max_ngram_repeats"] >= 4:
        flags.append({
            "code": "repetition",
            "severity": "high",
            "detail": f"4-gram repeated {rep['max_ngram_repeats']}x",
            "evidence": rep["worst_ngram"],
        })
    elif rep["type_token_ratio"] < 0.32 and n_words > 80:
        flags.append({
            "code": "low_lexical_variety",
            "severity": "low",
            "detail": f"type/token ratio {rep['type_token_ratio']:.2f}",
        })

    if any(ch for ch in text if unicodedata.category(ch) == "Cf"):
        flags.append({
            "code": "invisible_chars",
            "severity": "low",
            "detail": "zero-width / formatting characters present",
        })

    return {
        "metrics": {
            "chars": len(text),
            "words": n_words,
            "sentences": n_sent,
            "avg_sentence_words": round(n_words / n_sent, 1) if n_sent else 0,
            "az_specific_ratio": round(az_specific_ratio, 4),
            "schwa_count": schwa_count,
            "type_token_ratio": rep["type_token_ratio"],
        },
        "flags": flags,
        "mechanics_score": _mechanics_score(flags),
    }


def _repetition(words: list[str]) -> dict:
    ttr = round(len(set(words)) / len(words), 3) if words else 0.0
    counts: dict[tuple, int] = {}
    for i in range(len(words) - 3):
        gram = tuple(words[i : i + 4])
        counts[gram] = counts.get(gram, 0) + 1
    worst, worst_n = (), 0
    for gram, n in counts.items():
        if n > worst_n:
            worst, worst_n = gram, n
    return {
        "type_token_ratio": ttr,
        "max_ngram_repeats": worst_n,
        "worst_ngram": " ".join(worst) if worst_n > 1 else "",
    }


WEIGHTS = {"critical": 100, "high": 20, "medium": 8, "low": 3}


def _mechanics_score(flags: list[dict]) -> int:
    penalty = sum(WEIGHTS.get(f.get("severity", "low"), 3) for f in flags)
    return max(0, 100 - penalty)
