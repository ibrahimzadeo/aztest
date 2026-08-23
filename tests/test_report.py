"""The report is the artifact an external audience reads, so its honesty
properties are worth testing: escaped content, exclusions never dropped, and
the uncalibrated-judge caveat present exactly when it applies."""

import sys, pathlib
root = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root / "packages"))
sys.path.insert(0, str(root / "apps" / "api"))

import unittest

from app.report import render_report

ROW = {
    "model_id": "qwen-3.7-plus", "judge_score": 93.0, "mechanics_score": 100.0,
    "human_score": None, "human_ratings": 0, "generations": 6,
    "avg_latency_ms": 14583, "avg_output_tokens": 390,
}


def render(**over):
    args = dict(
        title="Hesabat", scope={"Dəst": "AZ-QUICK"}, rows=[ROW], dimensions={},
        errors=[], excluded=[], samples=[], agreement=None,
    )
    args.update(over)
    return render_report(**args)


class TestReport(unittest.TestCase):
    def test_is_a_complete_standalone_document(self):
        html = render()
        self.assertTrue(html.startswith("<!doctype html>"))
        self.assertIn("</html>", html)
        # No external assets: it has to survive being emailed as one file.
        for tag in ("<script", "src=http", 'href="http', "@import"):
            self.assertNotIn(tag, html)

    def test_declares_a4_print_geometry(self):
        self.assertIn("@page { size: A4", render())

    def test_uncalibrated_judge_caveat_appears_without_human_ratings(self):
        self.assertIn("kalibrlənməmiş", render())

    def test_caveat_disappears_once_humans_have_rated(self):
        rated = {**ROW, "human_score": 71.0, "human_ratings": 4}
        self.assertNotIn("kalibrlənməmiş", render(rows=[rated]))

    def test_methodology_precedes_results(self):
        html = render()
        self.assertLess(html.index("Metodologiya"), html.index("Nəticələr"))

    def test_rubric_weights_are_listed(self):
        html = render()
        self.assertIn("0.22", html)  # qrammatika carries the heaviest weight
        self.assertIn("Orfoqrafiya və diakritika", html)

    def test_exclusions_are_reported_not_dropped(self):
        html = render(excluded=[{"model_id": "deepseek-v4", "excluded": 3,
                                 "truncated": 3, "example": "truncated: ..."}])
        self.assertIn("Qiymətləndirilə bilməyən", html)
        self.assertIn("deepseek-v4", html)

    def test_limitations_section_is_always_present(self):
        self.assertIn("Məhdudiyyətlər", render())

    def test_model_output_is_escaped(self):
        html = render(samples=[{
            "model_id": "m", "task_code": "T", "score": 50.0,
            "excerpt": "<script>alert('x')</script> & <b>bold</b>",
            "errors": [{"quote": "<i>q</i>", "fix": "<u>f</u>", "issue": "orfoqrafiya"}],
        }])
        self.assertNotIn("<script>alert", html)
        self.assertIn("&lt;script&gt;", html)
        self.assertIn("&amp;", html)

    def test_scope_values_are_escaped(self):
        self.assertNotIn("<img", render(scope={"Dəst": "<img onerror=x>"}))

    def test_missing_scores_render_as_a_dash_not_zero(self):
        blank = {**ROW, "judge_score": None, "mechanics_score": None}
        html = render(rows=[blank])
        self.assertIn("—", html)
        self.assertNotIn(">0.0<", html)

    def test_agreement_block_only_with_pairs(self):
        self.assertNotIn("uyğunluğu", render(agreement={"pairs": 0}))
        self.assertIn("uyğunluğu", render(agreement={
            "pairs": 5, "mean_abs_diff": 8.2, "judge_mean": 88.0, "human_mean": 79.8}))


if __name__ == "__main__":
    unittest.main(verbosity=2)
