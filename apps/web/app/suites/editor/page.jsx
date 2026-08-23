"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, patch, post } from "@/lib/api";
import { useLang } from "@/lib/i18n";

function Editor() {
  const { t } = useLang();
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [form, setForm] = useState({ code: "", name: "", description: "" });
  const [tasks, setTasks] = useState([]);
  const [picked, setPicked] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/tasks").then((d) => setTasks(d.tasks)).catch((e) => setError(e.message));
    if (id)
      api(`/suites/${id}`)
        .then((s) => {
          setForm({ code: s.code, name: s.name, description: s.description });
          setPicked(s.tasks.map((t) => String(t.id)));
        })
        .catch((e) => setError(e.message));
  }, [id]);

  const toggle = (tid) =>
    setPicked(picked.includes(tid) ? picked.filter((x) => x !== tid) : [...picked, tid]);

  const byCategory = tasks.reduce((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {});

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = { ...form, task_ids: picked };
    try {
      if (id) await patch(`/suites/${id}`, body);
      else await post("/suites", body);
      router.push("/suites");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> {id ? t("common.edit") : t("common.new")}</div>
        <h1>{id ? form.name || t("runs.suite") : t("suites.new_suite")}</h1>
      </div>

      <div className="card">
        <div className="form-grid">
          <div>
            <label className="lbl">{t("common.code")}</label>
            <input className="field mono" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div>
            <label className="lbl">{t("common.name")}</label>
            <input className="field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="wide">
            <label className="lbl">{t("common.description")}</label>
            <input className="field" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>

        <h2 style={{ marginTop: 18 }}>{t("common.tasks")} ({picked.length} {t("common.selected")})</h2>
        <div className="check-groups">
          {Object.entries(byCategory).map(([cat, items]) => {
            const ids = items.map((t) => String(t.id));
            const allOn = ids.every((i) => picked.includes(i));
            return (
              <div className="check-group" key={cat}>
                <div
                  className="cg-head"
                  onClick={() =>
                    setPicked(allOn ? picked.filter((p) => !ids.includes(p)) : [...new Set([...picked, ...ids])])
                  }
                >
                  <input type="checkbox" checked={allOn} readOnly />
                  {cat}
                </div>
                {items.map((item) => (
                  <label className="picker-row" key={item.id}>
                    <input
                      type="checkbox"
                      checked={picked.includes(String(item.id))}
                      onChange={() => toggle(String(item.id))}
                    />
                    <span>
                      <span className="mono dim" style={{ fontSize: 11 }}>{item.code}</span>{" "}
                      {item.title}
                    </span>
                  </label>
                ))}
              </div>
            );
          })}
        </div>

        {error ? <p className="error" style={{ marginTop: 12 }}>{error}</p> : null}
        <div className="editor-actions">
          <button className="btn" disabled={busy || !picked.length}>
            {busy ? t("common.saving") : t("common.save")}
          </button>
          <button type="button" className="btn ghost" onClick={() => router.push("/suites")}>
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </form>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="spinner">…</p>}>
      <Editor />
    </Suspense>
  );
}
