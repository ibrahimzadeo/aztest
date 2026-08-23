# Scoring methodology

## Why three layers

Any single measure of "writes good Azerbaijani" fails in a predictable way:

- **Deterministic checks** cannot judge whether a sentence is natural, but they
  catch what an LLM judge routinely waves through: diacritics stripped to ASCII,
  a Turkish verb form, a Cyrillic fragment, the same clause four times.
- **An LLM judge** reads for naturalness, register and task compliance — and
  scores its own family's output generously.
- **Human blind rating** is the ground truth, and the only reason to trust or
  distrust the judge number. It is also the scarcest resource, so the tool asks
  for it a few answers at a time rather than for a whole run.

They are stored separately and shown side by side. When the judge and the human
disagree, that gap is the finding — not something to average away.

## The rubric

Six dimensions, 1–5, weighted into a 0–100 overall score
(`packages/azbench/rubric.py` is the single source of truth for both the judge
prompt and the human review screen, so the two cannot drift):

| Dimension | Weight | Reads for |
|---|---|---|
| Orfoqrafiya və diakritika | 0.20 | letters, diacritics, capitalisation, punctuation |
| Qrammatika və morfologiya | 0.22 | case suffixes, possession, agreement, tense, word order |
| Təbiilik və axıcılıq | 0.20 | would a native writer write this; translationese, calques |
| Leksika və terminologiya | 0.16 | word choice, domain terms, unnecessary russianisms/turkisms |
| Üslub və registr | 0.10 | the register the task asked for |
| Tapşırığa uyğunluq | 0.12 | content, length, format, required elements |

`overall = ((weighted mean of used dimensions) − 1) / 4 × 100`. Missing
dimensions are dropped and the remaining weights renormalised, so a partial
score is comparable rather than silently deflated.

## Mechanics score

Starts at 100 and subtracts per flag: critical 100, high 20, medium 8, low 3.
It only ever penalises hard evidence, and every flag ships the substring that
triggered it so a false positive is visible and dismissable.

Calibration note: clean Azerbaijani prose measures 15–30% "AZ-specific letters"
(`ə ğ ı ö ş ü ç`) of all letters. The diacritic checks only fire above 120
letters — below that there is not enough text for the ratio to be evidence.

## The task library

18 tasks across 9 categories, chosen to separate models rather than to flatter
them:

- **Registers that need real morphology** — official correspondence, a state-body
  application, an internal announcement with a strict paragraph structure.
- **Domains with settled terminology** — banking, a contract confidentiality
  clause, quarterly financial commentary, a mobile-banking how-to.
- **Translation where a calque is the obvious wrong answer** — an English HR
  rejection, a Russian service notice.
- **Orthography and adaptation traps** — a paragraph with stripped diacritics to
  repair and explain, a Turkish text to adapt (not translate) into Azerbaijani.
- **Instruction-following** — exact sentence counts, "every sentence ends in a
  verb", "no English words", a word ceiling. Format violations are visible
  without any judgement call.

Seeding is idempotent by task code and never overwrites an edited row.
