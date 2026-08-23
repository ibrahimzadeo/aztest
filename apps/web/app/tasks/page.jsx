"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, del, post } from "@/lib/api";

export default function Tasks() {
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
          ? `${r.tasks_created.length} tapşırıq əlavə edildi.`
          : "Bütün başlanğıc tapşırıqları artıq mövcuddur — heç nə dəyişməyib."
      );
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(t) {
    if (!confirm(`"${t.code}" silinsin? Bu tapşırığın keçmiş nəticələri qalır.`)) return;
    await del(`/tasks/${t.id}`).catch((e) => setError(e.message));
    load();
  }

  return (
    <>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> Kitabxana</div>
        <h1>Yazı tapşırıqları</h1>
        <p className="lede">
          Ölçmə bu tapşırıqlar üzərində qurulur. Başlanğıc dəst redaktə üçün açıqdır — öz
          tapşırıqlarını əlavə et, işə yaramayanı sıradan çıxar.
        </p>
      </div>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <div>
          <label className="lbl">Kateqoriya</label>
          <select className="field" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Hamısı ({tasks.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c} ({tasks.filter((t) => t.category === c).length})
              </option>
            ))}
          </select>
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn ghost" onClick={reseed} disabled={busy}>
          Başlanğıc dəsti bərpa et
        </button>
        <Link className="btn" href="/tasks/editor">Yeni tapşırıq</Link>
      </div>

      {error ? <p className="hint">{error}</p> : null}

      <div className="card">
        {shown.length === 0 ? (
          <div className="empty-state">
            <div className="icon">⌨</div>
            <p>Tapşırıq yoxdur.</p>
            <p className="hint">“Başlanğıc dəsti bərpa et” 18 hazır tapşırıq yükləyir.</p>
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Kod</th>
                <th>Başlıq</th>
                <th>Kateqoriya</th>
                <th>Registr</th>
                <th>Prompt</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.code}</td>
                  <td>
                    <Link href={`/tasks/editor?id=${t.id}`} style={{ color: "var(--accent)" }}>
                      {t.title}
                    </Link>
                    {!t.enabled ? <span className="chip warn" style={{ marginLeft: 8 }}>söndürülüb</span> : null}
                  </td>
                  <td className="muted">{t.category}</td>
                  <td className="dim">{t.register}</td>
                  <td className="dim" style={{ maxWidth: 320 }}>
                    {t.prompt.slice(0, 90)}{t.prompt.length > 90 ? "…" : ""}
                  </td>
                  <td>
                    <button className="btn small ghost" onClick={() => remove(t)}>Sil</button>
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
