"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, post, fmtCost } from "@/lib/api";
import { useLang } from "@/lib/i18n";
import { Flags, JudgePanel, Metrics, ModelPicker, OutputColumn, useModels, useRubric } from "./components";

// The examples stay in Azerbaijani in both interface languages: they are the
// text sent to the model, and this benchmark measures Azerbaijani writing.
const EXAMPLES = [
  "Bir bankın adından müştəriyə rəsmi üzrxahlıq məktubu yaz (150 söz).",
  "Bu cümləni redaktə et və səhvləri izah et: \"Hormetli mustəri, sizin muracietiniz baxildi.\"",
  "\"We regret to inform you that your application was unsuccessful\" — təbii Azərbaycan dilinə tərcümə et.",
];

export default function Playground() {
  const { t } = useLang();
  const { enabled } = useModels();
  const dimensions = useRubric();
  const [prompt, setPrompt] = useState("");
  const [system, setSystem] = useState("");
  const [selected, setSelected] = useState([]);
  const [judge, setJudge] = useState(false);
  const [run, setRun] = useState(null);
  const [gens, setGens] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const timer = useRef(null);

  // Preselect everything enabled the first time the roster arrives — the
  // point of the playground is comparison, so an empty selection is useless.
  useEffect(() => {
    if (enabled.length && !selected.length) setSelected(enabled.map((m) => m.model_id));
  }, [enabled.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const poll = useCallback(async (runId) => {
    const data = await api(`/runs/${runId}`);
    setRun(data.run);
    setGens(data.generations);
    const live = data.run.status === "QUEUED" || data.run.status === "RUNNING";
    if (!live && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => () => timer.current && clearInterval(timer.current), []);

  async function launch(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const created = await post("/playground", {
        prompt,
        system_prompt: system,
        models: selected,
        judge_enabled: judge,
      });
      setRun(created);
      setGens([]);
      setOpenId(null);
      await poll(created.id);
      timer.current = setInterval(() => poll(created.id).catch(() => {}), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const open = gens.find((g) => g.id === openId) || null;
  const cost = gens.reduce((a, g) => a + Number(g.cost || 0) + Number(g.judge_cost || 0), 0);

  return (
    <>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> {t("pg.eyebrow")}</div>
        <h1>{t("pg.h1")}</h1>
        <p className="lede">
          {t("pg.lede_1")}{" "}
          <Link href="/tasks" style={{ color: "var(--accent)" }}>{t("pg.lede_library")}</Link>{" "}
          {t("pg.lede_2")}{" "}
          <Link href="/suites" style={{ color: "var(--accent)" }}>{t("pg.lede_suite")}</Link>
          {t("pg.lede_3")}
        </p>
      </div>

      <form className="card primary" onSubmit={launch}>
        <h2>{t("common.prompt")}</h2>
        <textarea
          className="field"
          rows={5}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={t("pg.placeholder")}
        />
        <div className="pills" style={{ marginTop: 8 }}>
          {EXAMPLES.map((ex, i) => (
            <button type="button" key={i} className="btn small ghost" onClick={() => setPrompt(ex)}>
              {t("pg.example")} {i + 1}
            </button>
          ))}
        </div>

        <label className="lbl">{t("pg.system_prompt")}</label>
        <textarea
          className="field"
          rows={2}
          value={system}
          onChange={(e) => setSystem(e.target.value)}
          placeholder={t("pg.system_placeholder")}
        />

        <label className="lbl">{t("common.models")} ({selected.length} {t("common.selected")})</label>
        <ModelPicker models={enabled} selected={selected} onChange={setSelected} />

        <div className="actions" style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 16 }}>
          <button className="btn" disabled={busy || !prompt.trim() || !selected.length}>
            {busy ? t("pg.sending") : t("common.launch")}
          </button>
          <label className="pill">
            <input type="checkbox" checked={judge} onChange={(e) => setJudge(e.target.checked)} />
            {t("pg.judge_toggle")}
          </label>
          {error ? <span className="error">{error}</span> : null}
        </div>
      </form>

      {run ? (
        <>
          <div className="toolbar" style={{ margin: "18px 0 10px" }}>
            <h1 style={{ margin: 0, fontSize: 17 }}>{t("common.answers")}</h1>
            <span className="dim mono">{run.status}</span>
            <span className="dim">{gens.filter((g) => g.status === "DONE" || g.status === "ERROR").length}/{gens.length}</span>
            <span className="dim mono">{fmtCost(cost)}</span>
            <span style={{ flex: 1 }} />
            <Link className="btn small ghost" href={`/runs/${run.id}`}>{t("pg.run_page")}</Link>
          </div>
          <div className="columns">
            {gens.map((g) => (
              <OutputColumn key={g.id} gen={g} onOpen={(g) => setOpenId(g.id)} />
            ))}
          </div>
        </>
      ) : null}

      {open ? (
        <div className="card">
          <div className="toolbar">
            <h2 style={{ margin: 0 }}>{open.model_id} — {t("common.analysis").toLowerCase()}</h2>
            <span style={{ flex: 1 }} />
            <button className="btn small ghost" onClick={() => setOpenId(null)}>{t("common.close")}</button>
          </div>
          <h2 style={{ marginTop: 14 }}>{t("pg.mech_checks")}</h2>
          <Flags checks={open.checks} />
          <Metrics checks={open.checks} />
          <h2 style={{ marginTop: 16 }}>{t("common.judge")}</h2>
          <JudgePanel generation={open} dimensions={dimensions} />
        </div>
      ) : null}
    </>
  );
}
