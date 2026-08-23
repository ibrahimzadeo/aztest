"""Tests for the deterministic AZ checks, the rubric maths and judge parsing.

These are the parts that decide a score without a model in the loop, so they
are the parts that must not drift silently.
"""

import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "packages"))

import unittest

from azbench.checks import run_checks
from azbench.judge import JudgeError, _extract_json
from azbench.rubric import DIMENSION_KEYS, WEIGHTS, overall
from azbench.seed import QUICK_SUITE, TASKS

CLEAN_AZ = (
    "Hörmətli müştəri, müraciətinizə əsasən hesabat hazırlanmışdır. Şirkətimiz bu məsələ "
    "ilə əlaqədar əlavə məlumat təqdim etməyə hazırdır. Xidmətlərimizdən istifadə etdiyiniz "
    "üçün təşəkkür edirik və gələcək əməkdaşlığa ümid edirik. Sualınıza cavab olaraq "
    "bildiririk ki, ölkə üzrə bütün filiallarımızda bu xidmət mövcuddur."
)


class TestChecks(unittest.TestCase):
    def test_clean_azerbaijani_raises_no_flags(self):
        result = run_checks(CLEAN_AZ)
        self.assertEqual(result["flags"], [], f"unexpected flags: {result['flags']}")
        self.assertEqual(result["mechanics_score"], 100)

    def test_stripped_diacritics_are_caught(self):
        text = ("Hormetli musteri, sizin ucun melumat hazirlandi. Cox yaxsi isleyir ve duzgun "
                "neticelenir. Eger mumkun olsa, elaqe saxlayin, hemcinin muddet barede "
                "muracietinizi gozleyirik.")
        codes = {f["code"] for f in run_checks(text)["flags"]}
        self.assertIn("ascii_spelling", codes)
        self.assertIn("no_schwa", codes)

    def test_turkish_forms_are_caught(self):
        text = ("Değerli müşteri, talebiniz için rapor hazırlandı. Bu değil önemli, ancak "
                "sadece bir şey. Şimdi nasıl yapmak istediğinizi bilgi olarak paylaşın.")
        codes = {f["code"] for f in run_checks(text)["flags"]}
        self.assertIn("turkish_form", codes)

    def test_cyrillic_leakage_is_high_severity(self):
        flags = run_checks(CLEAN_AZ + " Спасибо за обращение.")["flags"]
        cyr = [f for f in flags if f["code"] == "cyrillic_leakage"]
        self.assertEqual(len(cyr), 1)
        self.assertEqual(cyr[0]["severity"], "high")

    def test_empty_output_is_critical_and_scores_zero(self):
        result = run_checks("")
        self.assertEqual(result["mechanics_score"], 0)
        self.assertEqual(result["flags"][0]["code"], "empty")

    def test_repetition_is_caught(self):
        text = "Bu xidmət çox yaxşıdır. " * 8
        codes = {f["code"] for f in run_checks(text)["flags"]}
        self.assertIn("repetition", codes)

    def test_short_ascii_text_is_not_penalised_for_missing_schwa(self):
        # The diacritic checks need enough text to be evidence, not noise.
        codes = {f["code"] for f in run_checks("Salam.")["flags"]}
        self.assertNotIn("no_schwa", codes)
        self.assertNotIn("low_diacritic_density", codes)


class TestRubric(unittest.TestCase):
    def test_weights_sum_to_one(self):
        self.assertAlmostEqual(sum(WEIGHTS.values()), 1.0, places=6)

    def test_overall_maps_1_to_0_and_5_to_100(self):
        self.assertEqual(overall({k: 1 for k in DIMENSION_KEYS}), 0.0)
        self.assertEqual(overall({k: 5 for k in DIMENSION_KEYS}), 100.0)
        self.assertEqual(overall({k: 3 for k in DIMENSION_KEYS}), 50.0)

    def test_partial_scores_renormalise_rather_than_deflate(self):
        # One dimension at 5 must not read as "20% of a perfect score".
        self.assertEqual(overall({DIMENSION_KEYS[0]: 5}), 100.0)

    def test_unknown_dimensions_are_ignored(self):
        self.assertIsNone(overall({"nonsense": 5}))
        self.assertIsNone(overall({}))


class TestJudgeParsing(unittest.TestCase):
    def test_plain_json(self):
        self.assertEqual(_extract_json('{"a": 1}'), {"a": 1})

    def test_fenced_json(self):
        self.assertEqual(_extract_json('```json\n{"a": 1}\n```'), {"a": 1})

    def test_json_wrapped_in_prose(self):
        self.assertEqual(_extract_json('Qiymət: {"a": 1} — bu qədər.'), {"a": 1})

    def test_non_json_raises(self):
        with self.assertRaises(JudgeError):
            _extract_json("heç bir JSON yoxdur")


class TestSeed(unittest.TestCase):
    def test_task_codes_are_unique(self):
        codes = [t["code"] for t in TASKS]
        self.assertEqual(len(codes), len(set(codes)))

    def test_every_task_has_a_prompt_and_category(self):
        for t in TASKS:
            self.assertTrue(t["prompt"].strip(), t["code"])
            self.assertTrue(t["category"].strip(), t["code"])
            self.assertIn(t["register"], {"formal", "neutral", "colloquial"}, t["code"])

    def test_quick_suite_references_existing_tasks(self):
        codes = {t["code"] for t in TASKS}
        for code in QUICK_SUITE["codes"]:
            self.assertIn(code, codes)


if __name__ == "__main__":
    unittest.main(verbosity=2)


class TestCompletionEmptiness(unittest.TestCase):
    """A missing answer must be diagnosable: bad writing and a blown token
    budget are different problems with opposite fixes."""

    def _parse(self, message, finish_reason="stop", usage=None):
        import time
        from azbench.nexum import _parse_completion
        return _parse_completion(
            {"choices": [{"message": message, "finish_reason": finish_reason}],
             "usage": usage or {}},
            "m", time.monotonic(),
        )

    def test_truncated_reasoning_reports_the_token_budget(self):
        c = self._parse(
            {"content": "", "reasoning_content": "düşünürəm…"},
            "length",
            {"completion_tokens": 1500, "completion_tokens_details": {"reasoning_tokens": 1500}},
        )
        self.assertTrue(c.truncated)
        self.assertEqual(c.reasoning_tokens, 1500)
        self.assertIn("truncated", c.emptiness_reason())
        self.assertIn("1500", c.emptiness_reason())

    def test_reasoning_is_never_used_as_the_answer(self):
        c = self._parse({"content": "", "reasoning": "plan: rəsmi məktub yaz"})
        self.assertEqual(c.text, "")
        self.assertIsNotNone(c.emptiness_reason())

    def test_inline_think_block_is_stripped(self):
        c = self._parse({"content": "<think>plan</think>Hörmətli müştəri."})
        self.assertEqual(c.text, "Hörmətli müştəri.")
        self.assertIsNone(c.emptiness_reason())

    def test_unclosed_think_block_leaves_no_answer(self):
        c = self._parse({"content": "<think>düşünürəm və bitirmədim"}, "length")
        self.assertEqual(c.text, "")
        self.assertIn("truncated", c.emptiness_reason())

    def test_a_real_answer_has_no_emptiness_reason(self):
        c = self._parse({"content": "Hörmətli müştəri, salam."})
        self.assertIsNone(c.emptiness_reason())
