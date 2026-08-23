"use client";

import { useEffect, useState } from "react";
import { api, del, post } from "@/lib/api";
import { useLang } from "@/lib/i18n";

const BLANK = {
  model_id: "", label: "", enabled: true, input_price_per_m: 0, output_price_per_m: 0,
  max_output_tokens: null, temperature: null, notes: "",
  reasoning_effort: "", extra_params: {},
};

const EFFORTS = ["", "minimal", "low", "medium", "high"];

export default function Models() {
  const { t } = useLang();
  const [roster, setRoster] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState(null);
  const [error, setError] = useState("");

  const load = () => api("/models").then((d) => setRoster(d.models)).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  async function fetchCatalog() {
    setLoading(true);
    setError("");
    try {
      setCatalog(await api("/provider/models"));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function add(id) {
    await post("/models", { ...BLANK, model_id: id }).catch((e) => setError(e.message));
    await load();
    if (catalog) fetchCatalog();
  }

  async function saveEdit(e) {
    e.preventDefault();
    try {
      let extra = {};
      const raw = (edit.extra_json ?? JSON.stringify(edit.extra_params || {}, null, 0)).trim();
      if (raw && raw !== "{}") {
        try {
          extra = JSON.parse(raw);
        } catch {
          setError(t("models.extra_bad_json"));
          return;
        }
        if (Array.isArray(extra) || typeof extra !== "object") {
          setError(`${t("models.extra_not_object")} {"enable_thinking": false}`);
          return;
        }
      }
      await post("/models", {
        ...edit,
        input_price_per_m: Number(edit.input_price_per_m || 0),
        output_price_per_m: Number(edit.output_price_per_m || 0),
        max_output_tokens: edit.max_output_tokens ? Number(edit.max_output_tokens) : null,
        temperature: edit.temperature === "" || edit.temperature === null ? null : Number(edit.temperature),
        reasoning_effort: edit.reasoning_effort || "",
        extra_params: extra,
      });
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(m) {
    if (!confirm(`${m.model_id} — ${t("models.confirm_delete")}`)) return;
    await del(`/models/${encodeURIComponent(m.model_id)}`).catch((e) => setError(e.message));
    load();
  }

  return (
    <div className="settings">
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> {t("models.eyebrow")}</div>
        <h1>{t("models.h1")}</h1>
        <p className="lede">
          {t("models.lede_1")} <span className="mono">/models</span> {t("models.lede_2")}
        </p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>{t("models.chosen")} ({roster.length})</h2>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={fetchCatalog} disabled={loading}>
            {loading ? t("models.loading_catalog") : t("models.load_catalog")}
          </button>
        </div>

        {roster.length === 0 ? (
          <div className="empty-state">
            <div className="icon">◇</div>
            <p>{t("models.empty")}</p>
            <p className="hint">{t("models.empty_hint")}</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Model</th><th>Ad</th><th>Aktiv</th><th>Input $/1M</th><th>Output $/1M</th>
                <th>Maks token</th><th>Düşünmə</th><th>Əlavə</th><th />
              </tr>
            </thead>
            <tbody>
              {roster.map((m) => (
                <tr key={m.model_id}>
                  <td className="mono">{m.model_id}</td>
                  <td>{m.label || <span className="dim">—</span>}</td>
                  <td>
                    {m.enabled
                      ? <span className="chip pass">{t("common.active")}</span>
                      : <span className="chip">{t("common.disabled")}</span>}
                  </td>
                  <td className="mono">{Number(m.input_price_per_m).toFixed(2)}</td>
                  <td className="mono">{Number(m.output_price_per_m).toFixed(2)}</td>
                  <td className="mono dim">{m.max_output_tokens || "—"}</td>
                  <td className="mono dim">{m.reasoning_effort || "—"}</td>
                  <td className="mono dim" style={{ maxWidth: 180, overflow: "hidden" }}>
                    {m.extra_params && Object.keys(m.extra_params).length
                      ? JSON.stringify(m.extra_params)
                      : "—"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn small ghost" onClick={() => setEdit({ ...m })}>{t("common.edit")}</button>{" "}
                    <button className="btn small ghost" onClick={() => remove(m)}>{t("common.delete")}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {edit ? (
        <form className="card primary" onSubmit={saveEdit}>
          <h2>{edit.model_id}</h2>
          <div className="form-grid cols-4">
            <div>
              <label className="lbl">{t("models.display_name")}</label>
              <input className="field" value={edit.label || ""} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
            </div>
            <div>
              <label className="lbl">{t("settings.in_price")}</label>
              <input className="field" type="number" step="0.01" value={edit.input_price_per_m}
                     onChange={(e) => setEdit({ ...edit, input_price_per_m: e.target.value })} />
            </div>
            <div>
              <label className="lbl">{t("settings.out_price")}</label>
              <input className="field" type="number" step="0.01" value={edit.output_price_per_m}
                     onChange={(e) => setEdit({ ...edit, output_price_per_m: e.target.value })} />
            </div>
            <div>
              <label className="lbl">{t("settings.max_out")}</label>
              <input className="field" type="number" value={edit.max_output_tokens || ""}
                     onChange={(e) => setEdit({ ...edit, max_output_tokens: e.target.value })} />
            </div>
            <div>
              <label className="lbl">{t("models.thinking_label")}</label>
              <select className="field" value={edit.reasoning_effort || ""}
                      onChange={(e) => setEdit({ ...edit, reasoning_effort: e.target.value })}>
                {EFFORTS.map((v) => <option key={v} value={v}>{v || t("settings.unset")}</option>)}
              </select>
              <p className="hint">{t("models.thinking_hint")}</p>
            </div>
            <div>
              <label className="lbl">{t("settings.temperature")}</label>
              <input className="field" type="number" step="0.1" value={edit.temperature ?? ""}
                     onChange={(e) => setEdit({ ...edit, temperature: e.target.value })} />
              <p className="hint">{t("models.temp_hint")}</p>
            </div>
            <div className="wide">
              <label className="lbl">{t("models.extra_label")}</label>
              <input className="field mono"
                     value={edit.extra_json ?? JSON.stringify(edit.extra_params || {})}
                     onChange={(e) => setEdit({ ...edit, extra_json: e.target.value })} />
              <p className="hint">
                {t("models.extra_hint_1")}{" "}
                <span className="mono">{'{"enable_thinking": false}'}</span>,{" "}
                <span className="mono">{'{"thinking": {"type": "disabled"}}'}</span>.{" "}
                {t("models.extra_hint_2")}
              </p>
            </div>
            <div className="wide">
              <label className="lbl">{t("common.note")}</label>
              <input className="field" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </div>
          </div>
          <label className="pill" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={!!edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} />
            {t("common.enabled")}
          </label>
          <div className="editor-actions">
            <button className="btn">{t("common.save")}</button>
            <button type="button" className="btn ghost" onClick={() => setEdit(null)}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      ) : null}

      {catalog ? (
        <div className="card">
          <h2>{t("models.catalog_h")} {catalog.models.length}</h2>
          <p className="card-desc mono dim">{catalog.base_url}</p>
          <table className="data">
            <thead><tr><th>{t("models.model_code")}</th><th>{t("models.owner")}</th><th>{t("models.context")}</th><th /></tr></thead>
            <tbody>
              {catalog.models.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.id}</td>
                  <td className="dim">{m.owned_by || "—"}</td>
                  <td className="mono dim">{m.context_length || "—"}</td>
                  <td>
                    {m.in_roster ? (
                      <span className="chip pass">{t("models.added")}</span>
                    ) : (
                      <button className="btn small" onClick={() => add(m.id)}>{t("common.add")}</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
