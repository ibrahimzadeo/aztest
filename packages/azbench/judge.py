"""LLM-as-judge for Azerbaijani writing quality.

The judge prompt is written in Azerbaijani on purpose: asking for AZ-language
error analysis in English measurably invites generic advice, while the AZ
prompt keeps the model inside the target language's norms. It must return
strict JSON; anything else is a judge failure, recorded as such rather than
silently scored.
"""

from __future__ import annotations

import json
import logging
import re

from .nexum import Completion, NexumClient, ProviderError
from .rubric import DIMENSIONS, DIMENSION_KEYS, overall

log = logging.getLogger("azbench.judge")

_DIM_BLOCK = "\n".join(
    f'- "{d["key"]}" — {d["label"]}: {d["guide"]}' for d in DIMENSIONS
)

JUDGE_SYSTEM = (
    "Sən Azərbaycan dilinin redaktoru və dilçi ekspertisən. Mətnləri Azərbaycan "
    "ədəbi dilinin normalarına görə qiymətləndirirsən. Yalnız JSON qaytarırsan, "
    "heç bir izahat, heç bir markdown blok işarəsi olmadan."
)

JUDGE_TEMPLATE = """Aşağıda bir dil modelinə verilmiş TAPŞIRIQ və onun CAVABI var.
Cavabı Azərbaycan dilində yazı keyfiyyətinə görə qiymətləndir.

Hər meyar üzrə 1-5 arası tam bal ver (1 = çox pis, 3 = qəbul edilə bilən, 5 = qüsursuz):
{dimensions}

Qiymətləndirmə qaydaları:
- Yalnız dil keyfiyyətini və tapşırığa uyğunluğu qiymətləndir; mövzu ilə razılaşıb-razılaşmamağın əhəmiyyəti yoxdur.
- Türkiyə türkcəsinə məxsus formalar (məsələn "değil", "için", "gibi", "şimdi") Azərbaycan dilində səhv sayılır.
- Diakritikanın buraxılması (ə, ğ, ı, ö, ş, ü, ç yerinə ASCII hərflər) orfoqrafiya səhvidir.
- Lüzumsuz rusizmlər və kalka ifadələr leksika balını aşağı salır.
- Konkret ol: hər səhvi sitat gətir və düzgün variantı yaz.

CAVABI YALNIZ bu JSON sxemi ilə qaytar:
{{
  "scores": {{{score_keys}}},
  "errors": [
    {{"quote": "mətndən dəqiq sitat", "issue": "səhvin adı", "fix": "düzgün variant", "type": "orfoqrafiya|qrammatika|leksika|uslub"}}
  ],
  "summary": "2-3 cümlə ilə ümumi rəy (Azərbaycan dilində)",
  "verdict": "excellent|good|acceptable|weak|unusable"
}}

--- TAPŞIRIQ ---
{task}

--- CAVAB ---
{answer}
--- SON ---
"""

_SCORE_KEYS = ", ".join(f'"{k}": 0' for k in DIMENSION_KEYS)


def build_prompt(task_prompt: str, answer: str) -> str:
    return JUDGE_TEMPLATE.format(
        dimensions=_DIM_BLOCK,
        score_keys=_SCORE_KEYS,
        task=task_prompt.strip(),
        answer=(answer or "").strip() or "(boş cavab)",
    )


class JudgeError(RuntimeError):
    pass


async def judge_output(
    client: NexumClient,
    model: str,
    task_prompt: str,
    answer: str,
    *,
    max_tokens: int = 2000,
) -> dict:
    """Score one output. Returns a dict ready to store on the generation."""
    if not (answer or "").strip():
        # No text to judge — score the floor rather than spending a call.
        return {
            "scores": {k: 1 for k in DIMENSION_KEYS},
            "overall": 0.0,
            "errors": [],
            "summary": "Model heç bir mətn qaytarmadı.",
            "verdict": "unusable",
            "judge_model": model,
            "prompt_tokens": 0,
            "completion_tokens": 0,
        }

    prompt = build_prompt(task_prompt, answer)
    try:
        completion: Completion = await client.complete(
            model, prompt, system=JUDGE_SYSTEM, temperature=0.0, max_tokens=max_tokens
        )
    except ProviderError as exc:
        raise JudgeError(f"judge call failed: {exc}") from exc

    data = _extract_json(completion.text)
    scores = {}
    for key in DIMENSION_KEYS:
        raw = (data.get("scores") or {}).get(key)
        if raw is None:
            continue
        try:
            scores[key] = max(1, min(5, int(round(float(raw)))))
        except (TypeError, ValueError):
            continue
    if not scores:
        raise JudgeError(f"judge returned no usable scores: {completion.text[:300]}")

    errors = []
    for item in (data.get("errors") or [])[:40]:
        if isinstance(item, dict):
            errors.append({
                "quote": str(item.get("quote", ""))[:400],
                "issue": str(item.get("issue", ""))[:200],
                "fix": str(item.get("fix", ""))[:400],
                "type": str(item.get("type", ""))[:40],
            })

    return {
        "scores": scores,
        "overall": overall(scores),
        "errors": errors,
        "summary": str(data.get("summary", ""))[:2000],
        "verdict": str(data.get("verdict", ""))[:40],
        "judge_model": model,
        "prompt_tokens": completion.prompt_tokens,
        "completion_tokens": completion.completion_tokens,
        "latency_ms": completion.latency_ms,
    }


_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.S)


def _extract_json(text: str) -> dict:
    """Judges wrap JSON in prose or fences no matter how firmly you ask them
    not to; recover the object instead of failing the whole generation."""
    text = (text or "").strip()
    for candidate in _candidates(text):
        try:
            data = json.loads(candidate)
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):
            return data
    raise JudgeError(f"judge response was not JSON: {text[:300]}")


def _candidates(text: str):
    yield text
    for match in _FENCE.findall(text):
        yield match.strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        yield text[start : end + 1]
