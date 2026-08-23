"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, del, post } from "@/lib/api";
import { ModelPicker, useModels } from "../components";
import { useLang } from "@/lib/i18n";

export default function Suites() {
  const { t } = useLang();
  const router = useRouter();
  const { enabled } = useModels();
  const [suites, setSuites] = useState([]);
  const [settings, setSettings] = useState(null);
  const [launch, setLaunch] = useState(null); // suite being launched
  const [models, setModels] = useState([]);
  const [judge, setJudge] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => api("/suites").then((d) => setSuites(d.suites)).catch((e) => setError(e.message));
  useEffect(() => {
    load();
    api("/settings").then(setSettings).catch(() => {});
  }, []);
  useEffect(() => {
    if (enabled.length && !models.length) setModels(enabled.map((m) => m.model_id));
  }, [enabled.length]); // eslint-disable-line react-hooks/exhaustive-deps

  async function start() {
    setBusy(true);
    setError("");
    try {
      const run = await post("/runs", {
        suite_id: launch.id,
        models,
        judge_enabled: judge,
      });
      router.push(`/runs/${run.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  async function remove(s) {
    if (!confirm(`"${s.code}" — ${t("suites.confirm_delete")}`)) return;
    await del(`/suites/${s.id}`).catch((e) => setError(e.message));
    load();
  }

  const planned = launch ? launch.task_count * models.length : 0;
  const conc = settings?.defaults?.concurrency || 3;

  return (
    <>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> {t("nav.suites")}</div>
        <h1>{t("suites.h1")}</h1>
        <p className="lede">{t("suites.lede")}</p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <span style={{ flex: 1 }} />
        <Link className="btn" href="/suites/editor">{t("suites.new_suite")}</Link>
      </div>

      <div className="card">
        {suites.length === 0 ? (
          <div className="empty-state">
            <div className="icon">▦</div>
            <p>{t("suites.empty")}</p>
            <p className="hint">{t("suites.empty_hint")}</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>{t("common.code")}</th><th>{t("common.name")}</th><th>{t("common.task")}</th><th>{t("common.description")}</th><th /></tr>
            </thead>
            <tbody>
              {suites.map((s) => (
                <tr key={s.id}>
                  <td className="mono">{s.code}</td>
                  <td>
                    <Link href={`/suites/editor?id=${s.id}`} style={{ color: "var(--accent)" }}>{s.name}</Link>
                  </td>
                  <td className="mono">{s.task_count}</td>
                  <td className="dim" style={{ maxWidth: 380 }}>{s.description}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn small" onClick={() => setLaunch(s)}>{t("common.launch")}</button>{" "}
                    <button className="btn small ghost" onClick={() => remove(s)}>{t("common.delete")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {launch ? (
        <div className="card primary">
          <div className="toolbar">
            <h2 style={{ margin: 0 }}>{launch.name} — {t("suites.launch_title")}</h2>
            <span style={{ flex: 1 }} />
            <button className="btn small ghost" onClick={() => setLaunch(null)}>{t("common.close")}</button>
          </div>
          <label className="lbl">{t("common.models")} ({models.length} {t("common.selected")})</label>
          <ModelPicker models={enabled} selected={models} onChange={setModels} />

          <div className="tiles">
            <div className="tile">
              <div className="label">{t("suites.task_count")}</div>
              <div className="value">{launch.task_count}</div>
            </div>
            <div className="tile">
              <div className="label">{t("common.model")}</div>
              <div className="value">{models.length}</div>
            </div>
            <div className="tile">
              <div className="label">{t("suites.answers_planned")}</div>
              <div className="value">{planned}</div>
              <div className="caption">
                {judge ? `+ ${planned} ${t("suites.judge_calls")}` : t("suites.judge_off")}
              </div>
            </div>
            <div className="tile">
              <div className="label">{t("suites.concurrency")}</div>
              <div className="value">{conc}</div>
              <div className="caption">{t("suites.concurrency_caption")}</div>
            </div>
          </div>

          <div className="caveat">
            <strong>{t("suites.time_note_label")}</strong> {planned} × {conc} — {t("suites.time_note")}
          </div>

          <label className="pill">
            <input type="checkbox" checked={judge} onChange={(e) => setJudge(e.target.checked)} />
            {t("pg.judge_toggle")} ({settings?.judge?.model || t("suites.judge_model_unset")})
          </label>

          <div className="editor-actions">
            <button className="btn" onClick={start} disabled={busy || !models.length}>
              {busy ? t("pg.sending") : `${planned} ${t("suites.launch_n")}`}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
