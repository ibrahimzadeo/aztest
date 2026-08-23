"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api, del, post } from "@/lib/api";
import { ModelPicker, useModels } from "../components";

export default function Suites() {
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
    if (!confirm(`"${s.code}" dəsti silinsin?`)) return;
    await del(`/suites/${s.id}`).catch((e) => setError(e.message));
    load();
  }

  const planned = launch ? launch.task_count * models.length : 0;
  const conc = settings?.defaults?.concurrency || 3;

  return (
    <>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> Dəstlər</div>
        <h1>Tapşırıq dəstləri</h1>
        <p className="lede">
          Bir dəst = bir işə salmada icra olunan tapşırıqlar. Eyni dəsti müxtəlif modellərlə
          işə salmaq nəticələri müqayisə olunan edir.
        </p>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <span style={{ flex: 1 }} />
        <Link className="btn" href="/suites/editor">Yeni dəst</Link>
      </div>

      <div className="card">
        {suites.length === 0 ? (
          <div className="empty-state">
            <div className="icon">▦</div>
            <p>Dəst yoxdur.</p>
            <p className="hint">Tapşırıqlar səhifəsində başlanğıc dəsti bərpa etsən, AZ-CORE və AZ-QUICK yaranır.</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr><th>Kod</th><th>Ad</th><th>Tapşırıq</th><th>Təsvir</th><th /></tr>
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
                    <button className="btn small" onClick={() => setLaunch(s)}>İşə sal</button>{" "}
                    <button className="btn small ghost" onClick={() => remove(s)}>Sil</button>
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
            <h2 style={{ margin: 0 }}>{launch.name} — işə sal</h2>
            <span style={{ flex: 1 }} />
            <button className="btn small ghost" onClick={() => setLaunch(null)}>Bağla</button>
          </div>
          <label className="lbl">Modellər ({models.length} seçilib)</label>
          <ModelPicker models={enabled} selected={models} onChange={setModels} />

          <div className="tiles">
            <div className="tile">
              <div className="label">Tapşırıq</div>
              <div className="value">{launch.task_count}</div>
            </div>
            <div className="tile">
              <div className="label">Model</div>
              <div className="value">{models.length}</div>
            </div>
            <div className="tile">
              <div className="label">Cavab sayı</div>
              <div className="value">{planned}</div>
              <div className="caption">{judge ? `+ ${planned} hakim çağırışı` : "hakim söndürülüb"}</div>
            </div>
            <div className="tile">
              <div className="label">Paralellik</div>
              <div className="value">{conc}</div>
              <div className="caption">Nexum 4-də 429 qaytarır — 3 təhlükəsiz həddir.</div>
            </div>
          </div>

          <div className="caveat">
            <strong>Vaxt gözləntisi:</strong> {planned} cavab (+hakim) paralellik {conc} ilə ardıcıl
            icra olunur. Böyük dəstlər üçün run səhifəsini açıq saxla — nəticələr gəldikcə görünür.
          </div>

          <label className="pill">
            <input type="checkbox" checked={judge} onChange={(e) => setJudge(e.target.checked)} />
            hakim qiyməti ({settings?.judge?.model || "model təyin edilməyib"})
          </label>

          <div className="editor-actions">
            <button className="btn" onClick={start} disabled={busy || !models.length}>
              {busy ? "Göndərilir…" : `${planned} cavabı işə sal`}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
