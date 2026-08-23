"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Score from "../score";
import { useRubric } from "../components";
import { api, fmtCost, fmtMs, fmtNum, reportUrl } from "@/lib/api";
import { dimGuide, dimLabel, useLang } from "@/lib/i18n";

function Board() {
  const { lang, t } = useLang();
  const params = useSearchParams();
  const runId = params.get("run_id") || "";
  const dimensions = useRubric();
  const [suites, setSuites] = useState([]);
  const [suiteId, setSuiteId] = useState("");
  const [rows, setRows] = useState([]);
  const [matrix, setMatrix] = useState({});
  const [agreement, setAgreement] = useState(null);
  const [errors, setErrors] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api("/suites").then((d) => setSuites(d.suites)).catch(() => {});
    api("/review/agreement").then(setAgreement).catch(() => {});
    api("/results/errors").then((d) => setErrors(d.rows)).catch(() => {});
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (runId) qs.set("run_id", runId);
    if (suiteId) qs.set("suite_id", suiteId);
    api(`/leaderboard?${qs}`).then((d) => setRows(d.rows)).catch((e) => setError(e.message));
    api(`/results/dimensions${suiteId ? `?suite_id=${suiteId}` : ""}`)
      .then((d) => setMatrix(d.matrix))
      .catch(() => {});
  }, [suiteId, runId]);

  return (
    <>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> {t("lb.eyebrow")}</div>
        <h1>{t("lb.h1")}</h1>
        <p className="lede">{t("lb.lede")}</p>
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div>
          <label className="lbl">{t("lb.filter_suite")}</label>
          <select className="field" value={suiteId} onChange={(e) => setSuiteId(e.target.value)}>
            <option value="">{t("lb.all_results")}</option>
            {suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {runId ? <span className="chip">{t("lb.one_run")}</span> : null}
        <span style={{ flex: 1 }} />
        <a
          className="btn"
          href={reportUrl(runId ? `/runs/${runId}` : `/overall${suiteId ? `?suite_id=${suiteId}` : ""}`)}
          target="_blank"
          rel="noreferrer"
        >
          {t("common.report_a4")}
        </a>
      </div>
      <p className="hint" style={{ marginTop: -6 }}>{t("lb.report_hint")}</p>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h2>{t("lb.ranking")}</h2>
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="icon">▤</div>
            <p>{t("lb.empty")}</p>
            <p className="hint">{t("lb.empty_hint")}</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>#</th><th>{t("common.model")}</th><th>{t("lb.judge_score")}</th>
                <th>{t("common.mechanics")}</th><th>{t("lb.human_score")}</th>
                <th>{t("common.answer")}</th><th>{t("lb.avg_latency")}</th>
                <th>{t("lb.avg_tokens")}</th><th>{t("common.cost")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.model_id}>
                  <td><span className={`rank ${i === 0 ? "top" : ""}`}>{i + 1}</span></td>
                  <td className="mono">{r.model_id}</td>
                  <td><Score value={r.judge_score} /></td>
                  <td><Score value={r.mechanics_score} width={92} /></td>
                  <td>
                    {r.human_ratings ? (
                      <>
                        <Score value={r.human_score} width={92} />
                        <span className="dim" style={{ fontSize: 11 }}> n={r.human_ratings}</span>
                      </>
                    ) : (
                      <span className="dim">—</span>
                    )}
                  </td>
                  <td className="mono">{r.generations}</td>
                  <td className="mono dim">{fmtMs(r.avg_latency_ms)}</td>
                  <td className="mono dim">{fmtNum(r.avg_output_tokens)}</td>
                  <td className="mono">{fmtCost(r.cost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {Object.keys(matrix).length ? (
        <div className="card">
          <h2>{t("lb.dimensions_h")}</h2>
          <p className="card-desc">{t("lb.dimensions_desc")}</p>
          <div className="matrix-wrap">
            <table className="data heat">
              <thead>
                <tr>
                  <th>{t("common.model")}</th>
                  {dimensions.map((d) => (
                    <th key={d.key} title={dimGuide(d, lang)}>{dimLabel(d, lang)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(matrix).map(([model, scores]) => (
                  <tr key={model}>
                    <td className="mono">{model}</td>
                    {dimensions.map((d) => {
                      const v = scores[d.key];
                      const color =
                        v === undefined ? "var(--ink-3)" : v >= 4 ? "var(--good)" : v >= 3 ? "var(--warning)" : "var(--serious)";
                      return (
                        <td className="h" key={d.key} style={{ color, fontWeight: 600 }}>
                          {v === undefined ? "—" : v.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="split">
        <div className="card">
          <h2>{t("lb.errors_h")}</h2>
          {errors.length === 0 ? (
            <p className="hint">{t("lb.errors_empty")}</p>
          ) : (
            <table className="data">
              <thead><tr><th>{t("runs.type")}</th><th>#</th></tr></thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.error_type}><td>{e.error_type}</td><td className="mono">{e.hits}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>{t("lb.agreement_h")}</h2>
          {!agreement || !agreement.pairs ? (
            <>
              <p className="hint">{t("lb.agreement_empty")}</p>
              <div className="caveat">
                <strong>{t("lb.agreement_caveat_label")}</strong> {t("lb.agreement_caveat")}
              </div>
            </>
          ) : (
            <div className="detail">
              <div className="row"><span>{t("lb.pairs")}</span><span className="mono">{agreement.pairs}</span></div>
              <div className="row"><span>{t("lb.mean_diff")}</span><span className="mono">{agreement.mean_abs_diff}</span></div>
              <div className="row"><span>{t("lb.judge_mean")}</span><span className="mono">{agreement.judge_mean}</span></div>
              <div className="row"><span>{t("lb.human_mean")}</span><span className="mono">{agreement.human_mean}</span></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="spinner">…</p>}>
      <Board />
    </Suspense>
  );
}
