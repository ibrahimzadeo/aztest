"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Score from "../score";
import { api, BASE_PATH, fmtCost, fmtWhen, runChip } from "@/lib/api";

export default function Runs() {
  const [runs, setRuns] = useState([]);
  const [kind, setKind] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () =>
      api(`/runs?limit=100${kind ? `&kind=${kind}` : ""}`)
        .then((d) => setRuns(d.runs))
        .catch((e) => setError(e.message));
    load();
    // Runs are long; refresh while the page is open so a finishing run does
    // not need a manual reload.
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [kind]);

  return (
    <>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> İşə salmalar</div>
        <h1>Run tarixçəsi</h1>
        <p className="lede">Hər run bir dəstin (və ya ad-hoc promptun) seçilmiş modellərdə icrasıdır.</p>
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div>
          <label className="lbl">Tip</label>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">Hamısı</option>
            <option value="suite">Dəst</option>
            <option value="playground">Playground</option>
          </select>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        {runs.length === 0 ? (
          <div className="empty-state">
            <div className="icon">◷</div>
            <p>Hələ run yoxdur.</p>
            <p className="hint">Dəstlər səhifəsindən bir dəst işə sal.</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Başlıq</th><th>Status</th><th>Tərəqqi</th><th>Orta bal</th>
                <th>Model</th><th>Xərc</th><th>Tarix</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => (window.location.href = `${BASE_PATH}/runs/${r.id}`)}>
                  <td>
                    <Link href={`/runs/${r.id}`} style={{ color: "var(--accent)" }}>{r.label || r.suite_name || "run"}</Link>
                    <span className="dim" style={{ marginLeft: 8, fontSize: 11 }}>{r.kind}</span>
                  </td>
                  <td><span className={runChip(r.status)}>{r.status}</span></td>
                  <td className="mono">{r.done}/{r.total}</td>
                  <td><Score value={r.avg_score} width={92} /></td>
                  <td className="mono dim">{(r.models || []).length}</td>
                  <td className="mono">{fmtCost(r.cost)}</td>
                  <td className="dim">{fmtWhen(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
