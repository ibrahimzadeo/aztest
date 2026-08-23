"use client";

import { useEffect, useState } from "react";
import Score from "./score";
import { api, fmtCost, fmtMs, VERDICT_CHIP } from "@/lib/api";

// The model roster lives in Settings; every launcher reads the same list so a
// model can never be run without its pricing and limits attached.
export function useModels() {
  const [models, setModels] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    api("/models")
      .then((d) => setModels(d.models))
      .catch((e) => setError(e.message));
  }, []);
  return { models, error, enabled: models.filter((m) => m.enabled) };
}

export function ModelPicker({ models, selected, onChange }) {
  const toggle = (id) =>
    onChange(selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id]);
  if (!models.length) {
    return (
      <p className="hint">
        Model siyahısı boşdur — <a href="/settings/models" style={{ color: "var(--accent)" }}>
        Parametrlər → Modellər</a> bölməsində provayder kataloqundan model əlavə et.
      </p>
    );
  }
  return (
    <div className="pills">
      {models.map((m) => (
        <label key={m.model_id} className={`pill ${m.enabled ? "" : "off"}`}>
          <input
            type="checkbox"
            checked={selected.includes(m.model_id)}
            onChange={() => toggle(m.model_id)}
          />
          {m.label || m.model_id}
        </label>
      ))}
    </div>
  );
}

// Deterministic checks. Every flag shows its evidence, because a heuristic
// the reader cannot dismiss is worse than no heuristic.
export function Flags({ checks }) {
  const flags = checks?.flags || [];
  if (!checks) return null;
  if (!flags.length) return <p className="hint">Mexaniki yoxlamalarda problem tapılmadı.</p>;
  return (
    <div className="flags">
      {flags.map((f, i) => (
        <div key={i} className={`flag sev-${f.severity}`}>
          <span className="code">{f.code}</span> — {f.detail}
          {f.evidence ? <span className="ev mono">{f.evidence}</span> : null}
        </div>
      ))}
    </div>
  );
}

export function Metrics({ checks }) {
  const m = checks?.metrics;
  if (!m) return null;
  return (
    <div className="foot">
      <span>{m.words} söz</span>
      <span>{m.sentences} cümlə</span>
      <span>orta {m.avg_sentence_words} söz/cümlə</span>
      <span className="mono">ə×{m.schwa_count}</span>
      <span className="mono">AZ hərf {(m.az_specific_ratio * 100).toFixed(1)}%</span>
    </div>
  );
}

export function JudgePanel({ generation, dimensions }) {
  const j = generation?.judge;
  if (generation?.judge_status === "OFF") return <p className="hint">Bu run üçün hakim söndürülüb.</p>;
  if (generation?.judge_status === "ERROR")
    return <p className="error">Hakim xətası: {generation.judge_error}</p>;
  if (!j) return <p className="hint">Hakim qiyməti hələ yoxdur.</p>;
  return (
    <>
      <div className="toolbar" style={{ marginBottom: 10 }}>
        <Score value={j.overall} width={150} />
        {j.verdict ? <span className={VERDICT_CHIP[j.verdict] || "chip"}>{j.verdict}</span> : null}
        <span className="dim mono">{j.judge_model}</span>
      </div>
      <div className="detail">
        {(dimensions || []).map((d) => (
          <div className="row" key={d.key}>
            <span>{d.label}</span>
            <span className="mono">{j.scores?.[d.key] ?? "—"} / 5</span>
          </div>
        ))}
      </div>
      {j.summary ? <p className="muted" style={{ marginTop: 12 }}>{j.summary}</p> : null}
      {j.errors?.length ? (
        <>
          <h2 style={{ marginTop: 16 }}>Tapılan səhvlər ({j.errors.length})</h2>
          <div className="errlist">
            {j.errors.map((e, i) => (
              <div className="errrow" key={i}>
                <span className="quote">{e.quote}</span>
                <span className="arrow">→</span>
                <span className="fix">{e.fix}</span>
                <span className="issue">
                  {e.issue} {e.type ? <span className="dim">· {e.type}</span> : null}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

// One model's answer as a column. Used by the playground and the run
// drill-down, so the two always render an output identically.
export function OutputColumn({ gen, onOpen }) {
  const running = gen.status === "RUNNING" || gen.status === "PENDING";
  return (
    <div className={`outcol ${gen.status === "ERROR" ? "errored" : ""}`}>
      <header>
        <span className="name">{gen.model_id}</span>
        <span className="spacer" />
        {running ? <span className="chip run">{gen.status === "RUNNING" ? "işləyir" : "gözləyir"}</span> : null}
        {gen.status === "ERROR" ? <span className="chip fail">xəta</span> : null}
        {gen.finish_reason === "length" && gen.status === "DONE" ? (
          <span className="chip warn" title="Cavab token həddində kəsilib — modelin 'Maks output token' dəyərini artır">
            kəsilib
          </span>
        ) : null}
        {gen.overall_score !== null && gen.overall_score !== undefined ? (
          <Score value={gen.overall_score} width={92} />
        ) : null}
        {gen.mechanics_score !== null && gen.mechanics_score !== undefined ? (
          <span className="chip" title="Mexaniki yoxlamalar (diakritika, kiril, təkrar)">
            mex {gen.mechanics_score}
          </span>
        ) : null}
      </header>
      <div className="body">
        {gen.status === "ERROR" ? (
          <span className="error">{gen.error}</span>
        ) : gen.output ? (
          gen.output
        ) : (
          <span className="dim">{running ? "…" : "(boş cavab)"}</span>
        )}
      </div>
      <div className="foot">
        <span className="mono">{fmtMs(gen.latency_ms)}</span>
        <span className="mono">{gen.completion_tokens} token</span>
        {gen.reasoning_tokens ? (
          <span className="mono dim" title="Düşünməyə xərclənən token">
            {gen.reasoning_tokens} düşünmə
          </span>
        ) : null}
        {gen.finish_reason ? <span className="mono dim">{gen.finish_reason}</span> : null}
        <span className="mono">{fmtCost(gen.cost)}</span>
        {onOpen ? (
          <button className="btn small ghost" style={{ marginLeft: "auto" }} onClick={() => onOpen(gen)}>
            Təhlil
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function useRubric() {
  const [dimensions, setDimensions] = useState([]);
  useEffect(() => {
    api("/rubric").then((d) => setDimensions(d.dimensions)).catch(() => {});
  }, []);
  return dimensions;
}
