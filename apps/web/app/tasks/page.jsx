"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, del, post } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function Tasks() {
  const { t } = useLang();
  const [tasks, setTasks] = useState([]);
  const [cat, setCat] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () =>
    api("/tasks")
      .then((d) => setTasks(d.tasks))
      .catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const categories = [...new Set(tasks.map((t) => t.category))].sort();
  const shown = cat ? tasks.filter((t) => t.category === cat) : tasks;

  async function reseed() {
    setBusy(true);
    try {
      const r = await post("/tasks/seed", {});
      setError(
        r.tasks_created.length
          ? `${r.tasks_created.length} ${t("tasks.seeded")}`
          : t("tasks.seeded_none")
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row) {
    if (!confirm(`"${row.code}" — ${t("tasks.confirm_delete")}`)) return;
    await del(`/tasks/${row.id}`).catch((e) => setError(e.message));
    load();
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> {t("tasks.eyebrow")}</div>
        <h1>{t("tasks.h1")}</h1>
        <p className="lede">{t("tasks.lede")}</p>
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div>
          <label className="lbl">{t("common.category")}</label>
          <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">{t("common.all")} ({tasks.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c} ({tasks.filter((t) => t.category === c).length})
              </option>
            ))}
          </select>
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn ghost" onClick={reseed} disabled={busy}>
          {t("tasks.reseed")}
        </button>
        <Link className="btn" href="/tasks/editor">{t("tasks.new_task")}</Link>
      </div>

      {error ? <p className="hint">{error}</p> : null}

      <div className="card">
        {shown.length === 0 ? (
          <div className="empty-state">
            <div className="icon">⌨</div>
            <p>{t("tasks.empty")}</p>
            <p className="hint">{t("tasks.empty_hint")}</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>{t("common.code")}</th>
                <th>{t("common.title")}</th>
                <th>{t("common.category")}</th>
                <th>{t("common.register")}</th>
                <th>{t("common.prompt")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{row.code}</td>
                  <td>
                    <Link href={`/tasks/editor?id=${row.id}`} style={{ color: "var(--accent)" }}>
                      {row.title}
                    </Link>
                    {!row.enabled ? (
                      <span className="chip warn" style={{ marginLeft: 8 }}>{t("common.disabled")}</span>
                    ) : null}
                  </td>
                  <td className="muted">{row.category}</td>
                  <td className="dim">{row.register}</td>
                  <td className="dim" style={{ maxWidth: 320 }}>
                    {row.prompt.slice(0, 90)}{row.prompt.length > 90 ? "…" : ""}
                  </td>
                  <td>
                    <button className="btn small ghost" onClick={() => remove(row)}>{t("common.delete")}</button>
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
