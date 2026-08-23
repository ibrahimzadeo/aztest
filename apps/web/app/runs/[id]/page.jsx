"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Score from "../../score";
import { Flags, JudgePanel, Metrics, OutputColumn, useRubric } from "../../components";
import { api, fmtCost, fmtMs, fmtWhen, post, reportUrl, runChip } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function RunDetail() {
  const { t } = useLang();
  const { id } = useParams();
  const dimensions = useRubric();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [openTask, setOpenTask] = useState(null);
  const [openGenId, setOpenGenId] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    const d = await api(`/runs/${id}`);
    setData(d);
    if (d.run.status !== "QUEUED" && d.run.status !== "RUNNING" && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [id]);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    timer.current = setInterval(() => load().catch(() => {}), 3000);
    return () => timer.current && clearInterval(timer.current);
  }, [load]);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="spinner">{t("common.loading")}</p>;

  const { run, generations, models, tasks } = data;
  const done = generations.filter((g) => g.status === "DONE" || g.status === "ERROR").length;
  const cost = generations.reduce((a, g) => a + Number(g.cost || 0) + Number(g.judge_cost || 0), 0);
  const scored = generations.filter((g) => g.overall_score !== null && g.overall_score !== undefined);
  const avg = scored.length ? scored.reduce((a, g) => a + Number(g.overall_score), 0) / scored.length : null;
  const cell = (taskCode, modelId) =>
    generations.find((g) => g.task_code === taskCode && g.model_id === modelId);
  const openGen = generations.find((g) => g.id === openGenId) || null;
  const taskGens = openTask ? generations.filter((g) => g.task_code === openTask) : [];

  async function cancel() {
    await post(`/runs/${run.id}/cancel`, {}).catch((e) => setError(e.message));
    load();
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow">
          <span className="dot" /> {run.kind === "playground" ? t("nav.playground") : t("runs.suite")} · run
        </div>
        <h1>{run.label || run.suite_name || "Run"}</h1>
        <p className="lede">
          {tasks.length} {t("runs.detail_lede_1")} {models.length} {t("runs.detail_lede_2")}{" "}
          {run.judge_enabled ? run.judge_model : t("runs.detail_judge_off")}.
        </p>
      </div>

      <div className="toolbar" style={{ marginBottom: 8 }}>
        <span className={runChip(run.status)}>{run.status}</span>
        <span className="dim mono">{done}/{generations.length}</span>
        <span style={{ flex: 1 }} />
        {(run.status === "RUNNING" || run.status === "QUEUED") ? (
          <button className="btn small ghost" onClick={cancel}>{t("runs.cancel")}</button>
        ) : null}
        <Link className="btn small ghost" href={`/leaderboard?run_id=${run.id}`}>{t("runs.lb_for_run")}</Link>
        <a className="btn small" href={reportUrl(`/runs/${run.id}`)} target="_blank" rel="noreferrer">
          {t("common.report_a4")}
        </a>
      </div>

      <div className="tiles">
        <div className="tile">
          <div className="label">{t("runs.avg_score")}</div>
          <div className="value">{avg === null ? "—" : avg.toFixed(1)}</div>
          <div className="caption">{t("runs.judge_score_0_100")}</div>
        </div>
        <div className="tile">
          <div className="label">{t("runs.errors_tile")}</div>
          <div className="value">{generations.filter((g) => g.status === "ERROR").length}</div>
          <div className="caption">{t("runs.errors_caption")}</div>
        </div>
        <div className="tile">
          <div className="label">{t("common.cost")}</div>
          <div className="value">{fmtCost(cost)}</div>
          <div className="caption">{t("runs.cost_caption")}</div>
        </div>
        <div className="tile">
          <div className="label">{t("runs.started")}</div>
          <div className="value" style={{ fontSize: 15 }}>{fmtWhen(run.started_at)}</div>
          <div className="caption">
            {run.totals?.wall_seconds ? `${run.totals.wall_seconds}s ${t("runs.execution")}` : ""}
          </div>
        </div>
      </div>

      <div className="card">
        <h2>{t("runs.matrix")}</h2>
        <p className="card-desc">{t("runs.matrix_desc")}</p>
        <div className="matrix-wrap">
          <table className="matrix">
            <thead>
              <tr>
                <th style={{ minWidth: 220 }}>{t("common.task")}</th>
                {models.map((m) => <th key={m} className="mono">{m}</th>)}
              </tr>
            </thead>
            <tbody>
              {tasks.map((t) => (
                <tr key={t.code}>
                  <th className="rowhead" onClick={() => setOpenTask(t.code)} style={{ cursor: "pointer" }}>
                    {t.title}
                    <span className="code">{t.code}</span>
                  </th>
                  {models.map((m) => {
                    const g = cell(t.code, m);
                    if (!g) return <td key={m} className="cell empty">—</td>;
                    return (
                      <td key={m} className="cell" onClick={() => setOpenGenId(g.id)}>
                        {g.status === "ERROR" ? (
                          <span className="chip fail">{t("common.error")}</span>
                        ) : g.status !== "DONE" ? (
                          <span className="chip run">
                            {g.status === "RUNNING" ? t("common.running") : t("common.queued")}
                          </span>
                        ) : (
                          <>
                            <Score value={g.overall_score} width={88} />
                            <span className="dim mono" style={{ fontSize: 11 }}> {t("common.mechanics_short")} {g.mechanics_score}</span>
                          </>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {openTask ? (
        <div className="card">
          <div className="toolbar">
            <h2 style={{ margin: 0 }}>{openTask} — {t("runs.side_by_side")}</h2>
            <span style={{ flex: 1 }} />
            <button className="btn small ghost" onClick={() => setOpenTask(null)}>{t("common.close")}</button>
          </div>
          <p className="card-desc">{taskGens[0]?.prompt}</p>
          <div className="columns">
            {taskGens.map((g) => (
              <OutputColumn key={g.id} gen={g} onOpen={(x) => setOpenGenId(x.id)} />
            ))}
          </div>
        </div>
      ) : null}

      {openGen ? (
        <div className="card primary">
          <div className="toolbar">
            <h2 style={{ margin: 0 }}>
              {openGen.task_code} · <span className="mono">{openGen.model_id}</span>
            </h2>
            <span style={{ flex: 1 }} />
            <span className="dim mono">{fmtMs(openGen.latency_ms)}</span>
            <button className="btn small ghost" onClick={() => setOpenGenId(null)}>{t("common.close")}</button>
          </div>

          <h2 style={{ marginTop: 12 }}>{t("common.answer")}</h2>
          <div className="outcol"><div className="body">{openGen.output || <span className="dim">{t("common.empty_answer")}</span>}</div></div>

          <div className="split" style={{ marginTop: 16 }}>
            <div>
              <h2>{t("pg.mech_checks")}</h2>
              <Flags checks={openGen.checks} />
              <Metrics checks={openGen.checks} />
            </div>
            <div>
              <h2>{t("common.judge")}</h2>
              <JudgePanel generation={openGen} dimensions={dimensions} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
