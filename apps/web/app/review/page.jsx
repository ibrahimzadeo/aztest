"use client";

import { useEffect, useState } from "react";
import { useRubric } from "../components";
import { dimGuide, dimLabel, useLang } from "@/lib/i18n";
import { api, post } from "@/lib/api";

// Blind review: the queue endpoint never returns model_id, so nothing on this
// screen can reveal which model wrote the text being rated.
export default function Review() {
  const { lang, t } = useLang();
  const dimensions = useRubric();
  const [rater, setRater] = useState("reviewer");
  const [queue, setQueue] = useState([]);
  const [index, setIndex] = useState(0);
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem("aztest_rater");
    if (stored) setRater(stored);
  }, []);

  function load(name = rater) {
    api(`/review/queue?rater=${encodeURIComponent(name)}&limit=50`)
      .then((d) => {
        setQueue(d.queue);
        setIndex(0);
        setScores({});
        setComment("");
      })
      .catch((e) => setError(e.message));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const current = queue[index];
  const complete = dimensions.length && dimensions.every((d) => scores[d.key]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await post(`/review/${current.id}`, { rater, scores, comment });
      setSaved(saved + 1);
      setScores({});
      setComment("");
      if (index + 1 >= queue.length) load();
      else setIndex(index + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> {t("nav.review")}</div>
        <h1>{t("review.h1")}</h1>
        <p className="lede">{t("review.lede")}</p>
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div>
          <label className="lbl">{t("review.rater")}</label>
          <input
            className="field"
            value={rater}
            onChange={(e) => setRater(e.target.value)}
            onBlur={(e) => {
              localStorage.setItem("aztest_rater", e.target.value);
              load(e.target.value);
            }}
          />
        </div>
        <span className="dim">{t("review.in_queue")} {queue.length}</span>
        <span className="dim">{t("review.this_session")} {saved}</span>
      </div>

      {error ? <p className="error">{error}</p> : null}

      {!current ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">✓</div>
            <p>{t("review.queue_empty")}</p>
            <p className="hint">{t("review.queue_empty_hint")}</p>
          </div>
        </div>
      ) : (
        <>
          <div className="card">
            <h2>{t("common.task")} <span className="dim mono">{current.task_code}</span></h2>
            <p className="muted" style={{ whiteSpace: "pre-wrap" }}>{current.prompt}</p>
          </div>

          <div className="card primary">
            <h2>{t("common.answer")}</h2>
            <div className="outcol">
              <div className="body">{current.output}</div>
            </div>
          </div>

          <form className="card" onSubmit={submit}>
            <h2>{t("review.score_1_5")}</h2>
            <div className="rate">
              {dimensions.map((d) => (
                <div key={d.key} style={{ display: "contents" }}>
                  <div className="dim">
                    {dimLabel(d, lang)}
                    <small>{dimGuide(d, lang)}</small>
                  </div>
                  <div className="scale">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <label key={n}>
                        <input
                          type="radio"
                          name={d.key}
                          checked={scores[d.key] === n}
                          onChange={() => setScores({ ...scores, [d.key]: n })}
                        />
                        {n}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <label className="lbl">{t("common.hint_note")}</label>
            <textarea className="field" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />

            <div className="editor-actions">
              <button className="btn" disabled={busy || !complete}>
                {busy ? t("common.saving") : t("review.submit")}
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => setIndex(Math.min(index + 1, queue.length - 1))}
              >
                {t("review.skip")}
              </button>
            </div>
          </form>
        </>
      )}
    </>
  );
}
