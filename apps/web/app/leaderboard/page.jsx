"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Score from "../score";
import { useRubric } from "../components";
import { api, fmtCost, fmtMs, fmtNum } from "@/lib/api";

function Board() {
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
        <div className="eyebrow"><span className="dot" /> Reytinq</div>
        <h1>Modellərin Azərbaycan dili üzrə balları</h1>
        <p className="lede">
          Hakim balı — LLM qiymətləndirməsi (0-100). Mexanika — diakritika, kiril sızması,
          türkcə formalar, təkrar üzrə deterministik yoxlama. İnsan balı — kor
          qiymətləndirmədə verilən qiymət.
        </p>
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div>
          <label className="lbl">Dəst üzrə filtr</label>
          <select className="field" value={suiteId} onChange={(e) => setSuiteId(e.target.value)}>
            <option value="">Bütün nəticələr</option>
            {suites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {runId ? <span className="chip">yalnız bir run</span> : null}
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <h2>Sıralama</h2>
        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="icon">▤</div>
            <p>Nəticə yoxdur.</p>
            <p className="hint">Bir dəst işə salındıqdan sonra buradaki cədvəl dolur.</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>#</th><th>Model</th><th>Hakim balı</th><th>Mexanika</th><th>İnsan balı</th>
                <th>Cavab</th><th>Orta gecikmə</th><th>Orta token</th><th>Xərc</th>
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
          <h2>Meyarlar üzrə orta bal (1-5)</h2>
          <p className="card-desc">
            Ümumi bal yaxın olan modellər burada ayrılır: biri orfoqrafiyada, digəri
            təbiilikdə uduzur.
          </p>
          <div className="matrix-wrap">
            <table className="data heat">
              <thead>
                <tr>
                  <th>Model</th>
                  {dimensions.map((d) => <th key={d.key} title={d.guide}>{d.label}</th>)}
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
          <h2>Ən çox rast gəlinən səhv tipləri</h2>
          {errors.length === 0 ? (
            <p className="hint">Hakim səhv siyahısı hələ boşdur.</p>
          ) : (
            <table className="data">
              <thead><tr><th>Tip</th><th>Say</th></tr></thead>
              <tbody>
                {errors.map((e) => (
                  <tr key={e.error_type}><td>{e.error_type}</td><td className="mono">{e.hits}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2>Hakim ↔ insan uyğunluğu</h2>
          {!agreement || !agreement.pairs ? (
            <>
              <p className="hint">Hələ müqayisə üçün insan qiyməti yoxdur.</p>
              <div className="caveat">
                <strong>Diqqət:</strong> insan qiyməti olmadan hakim balı kalibrlənməmiş
                göstəricidir. Kor qiymətləndirmə səhifəsində bir neçə cavabı qiymətləndir —
                aradaki fərq burada rəqəmlə görünəcək.
              </div>
            </>
          ) : (
            <div className="detail">
              <div className="row"><span>Müqayisə edilən cüt</span><span className="mono">{agreement.pairs}</span></div>
              <div className="row"><span>Orta fərq (|hakim − insan|)</span><span className="mono">{agreement.mean_abs_diff}</span></div>
              <div className="row"><span>Hakimin ortası</span><span className="mono">{agreement.judge_mean}</span></div>
              <div className="row"><span>İnsanın ortası</span><span className="mono">{agreement.human_mean}</span></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="spinner">Yüklənir…</p>}>
      <Board />
    </Suspense>
  );
}
