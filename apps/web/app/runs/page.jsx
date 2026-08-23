"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Score from "../score";
import { api, BASE_PATH, del, fmtCost, fmtWhen, runChip } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function Runs() {
  const { t } = useLang();
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

  async function remove(run, e) {
    e.stopPropagation();
    if (!confirm(`"${run.label || run.suite_name}" — ${t("runs.confirm_delete_1")}\n\n` +
                 t("runs.confirm_delete_2"))) return;
    try {
      await del(`/runs/${run.id}`);
      setRuns(runs.filter((r) => r.id !== run.id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> {t("nav.runs")}</div>
        <h1>{t("runs.h1")}</h1>
        <p className="lede">{t("runs.lede")}</p>
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div>
          <label className="lbl">{t("runs.type")}</label>
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="">{t("common.all")}</option>
            <option value="suite">{t("runs.suite")}</option>
            <option value="playground">Playground</option>
          </select>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <div className="card">
        {runs.length === 0 ? (
          <div className="empty-state">
            <div className="icon">◷</div>
            <p>{t("runs.empty")}</p>
            <p className="hint">{t("runs.empty_hint")}</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Başlıq</th><th>Status</th><th>Tərəqqi</th><th>Orta bal</th>
                <th>Model</th><th>Xərc</th><th>Tarix</th><th />
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
                  <td>
                    {r.status === "RUNNING" || r.status === "QUEUED" ? null : (
                      <button className="btn small ghost" onClick={(e) => remove(r, e)}>
                        {t("common.delete")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
