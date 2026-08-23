"use client";

import { useEffect, useState } from "react";
import { api, del, post } from "@/lib/api";

const BLANK = {
  model_id: "", label: "", enabled: true, input_price_per_m: 0, output_price_per_m: 0,
  max_output_tokens: null, temperature: null, notes: "",
};

export default function Models() {
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
      await post("/models", {
        ...edit,
        input_price_per_m: Number(edit.input_price_per_m || 0),
        output_price_per_m: Number(edit.output_price_per_m || 0),
        max_output_tokens: edit.max_output_tokens ? Number(edit.max_output_tokens) : null,
        temperature: edit.temperature === "" || edit.temperature === null ? null : Number(edit.temperature),
      });
      setEdit(null);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(m) {
    if (!confirm(`${m.model_id} siyahıdan silinsin? Keçmiş nəticələr qalır.`)) return;
    await del(`/models/${encodeURIComponent(m.model_id)}`).catch((e) => setError(e.message));
    load();
  }

  return (
    <div className="settings">
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> Modellər</div>
        <h1>Test edilən modellər</h1>
        <p className="lede">
          Kataloq provayderin <span className="mono">/models</span> endpointindən canlı oxunur —
          marketinq səhifəsi API-nin verdiyi modellərin hamısını göstərmir.
        </p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        <div className="toolbar">
          <h2 style={{ margin: 0 }}>Seçilmiş modellər ({roster.length})</h2>
          <span style={{ flex: 1 }} />
          <button className="btn ghost" onClick={fetchCatalog} disabled={loading}>
            {loading ? "Kataloq yüklənir… (~20s)" : "Provayder kataloqunu yüklə"}
          </button>
        </div>

        {roster.length === 0 ? (
          <div className="empty-state">
            <div className="icon">◇</div>
            <p>Model seçilməyib.</p>
            <p className="hint">Kataloqu yüklə və test etmək istədiyin modelləri əlavə et.</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Model</th><th>Ad</th><th>Aktiv</th><th>Input $/1M</th><th>Output $/1M</th>
                <th>Maks token</th><th>Temp</th><th />
              </tr>
            </thead>
            <tbody>
              {roster.map((m) => (
                <tr key={m.model_id}>
                  <td className="mono">{m.model_id}</td>
                  <td>{m.label || <span className="dim">—</span>}</td>
                  <td>{m.enabled ? <span className="chip pass">aktiv</span> : <span className="chip">söndürülüb</span>}</td>
                  <td className="mono">{Number(m.input_price_per_m).toFixed(2)}</td>
                  <td className="mono">{Number(m.output_price_per_m).toFixed(2)}</td>
                  <td className="mono dim">{m.max_output_tokens || "—"}</td>
                  <td className="mono dim">{m.temperature ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn small ghost" onClick={() => setEdit({ ...m })}>Redaktə</button>{" "}
                    <button className="btn small ghost" onClick={() => remove(m)}>Sil</button>
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
              <label className="lbl">Görünən ad</label>
              <input className="field" value={edit.label || ""} onChange={(e) => setEdit({ ...edit, label: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Input $/1M</label>
              <input className="field" type="number" step="0.01" value={edit.input_price_per_m}
                     onChange={(e) => setEdit({ ...edit, input_price_per_m: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Output $/1M</label>
              <input className="field" type="number" step="0.01" value={edit.output_price_per_m}
                     onChange={(e) => setEdit({ ...edit, output_price_per_m: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Maks output token</label>
              <input className="field" type="number" value={edit.max_output_tokens || ""}
                     onChange={(e) => setEdit({ ...edit, max_output_tokens: e.target.value })} />
            </div>
            <div>
              <label className="lbl">Temperature</label>
              <input className="field" type="number" step="0.1" value={edit.temperature ?? ""}
                     onChange={(e) => setEdit({ ...edit, temperature: e.target.value })} />
              <p className="hint">Boş = run defoltu.</p>
            </div>
            <div className="wide">
              <label className="lbl">Qeyd</label>
              <input className="field" value={edit.notes || ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </div>
          </div>
          <label className="pill" style={{ marginTop: 10 }}>
            <input type="checkbox" checked={!!edit.enabled} onChange={(e) => setEdit({ ...edit, enabled: e.target.checked })} />
            aktivdir
          </label>
          <div className="editor-actions">
            <button className="btn">Yadda saxla</button>
            <button type="button" className="btn ghost" onClick={() => setEdit(null)}>Ləğv et</button>
          </div>
        </form>
      ) : null}

      {catalog ? (
        <div className="card">
          <h2>Provayder kataloqu — {catalog.models.length} model</h2>
          <p className="card-desc mono dim">{catalog.base_url}</p>
          <table className="data">
            <thead><tr><th>Model kodu</th><th>Sahib</th><th>Kontekst</th><th /></tr></thead>
            <tbody>
              {catalog.models.map((m) => (
                <tr key={m.id}>
                  <td className="mono">{m.id}</td>
                  <td className="dim">{m.owned_by || "—"}</td>
                  <td className="mono dim">{m.context_length || "—"}</td>
                  <td>
                    {m.in_roster ? (
                      <span className="chip pass">əlavə edilib</span>
                    ) : (
                      <button className="btn small" onClick={() => add(m.id)}>Əlavə et</button>
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
