"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, patch, post } from "@/lib/api";

const REGISTERS = ["formal", "neutral", "colloquial"];
const BLANK = {
  code: "", title: "", category: "Rəsmi yazışma", register: "neutral",
  prompt: "", system_prompt: "", guidance: "", enabled: true,
};

function Editor() {
  const params = useSearchParams();
  const router = useRouter();
  const id = params.get("id");
  const [form, setForm] = useState(BLANK);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/tasks").then((d) => setCategories(d.categories)).catch(() => {});
    if (id) api(`/tasks/${id}`).then(setForm).catch((e) => setError(e.message));
  }, [id]);

  const set = (k) => (e) =>
    setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const body = {
      code: form.code, title: form.title, category: form.category, register: form.register,
      prompt: form.prompt, system_prompt: form.system_prompt || "",
      guidance: form.guidance || "", enabled: !!form.enabled,
    };
    try {
      if (id) await patch(`/tasks/${id}`, body);
      else await post("/tasks", body);
      router.push("/tasks");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> {id ? "Redaktə" : "Yeni"}</div>
        <h1>{id ? form.title || "Tapşırıq" : "Yeni tapşırıq"}</h1>
      </div>

      <div className="card">
        <div className="form-grid">
          <div>
            <label className="lbl">Kod</label>
            <input className="field mono" value={form.code} onChange={set("code")} placeholder="RESMI-03" required />
            <p className="hint">Qısa, unikal identifikator — nəticələrdə bu görünür.</p>
          </div>
          <div>
            <label className="lbl">Başlıq</label>
            <input className="field" value={form.title} onChange={set("title")} required />
          </div>
          <div>
            <label className="lbl">Kateqoriya</label>
            <input className="field" value={form.category} onChange={set("category")} list="cats" />
            <datalist id="cats">
              {categories.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="lbl">Registr</label>
            <select className="field" value={form.register} onChange={set("register")}>
              {REGISTERS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="wide">
            <label className="lbl">Prompt</label>
            <textarea className="field" rows={7} value={form.prompt} onChange={set("prompt")} required />
            <p className="hint">
              Modelə verilən mətn. Uzunluq, format və registr tələblərini prompta yazsan,
              “təlimata uyğunluq” meyarı ölçülə bilən olur.
            </p>
          </div>
          <div className="wide">
            <label className="lbl">Sistem promptu (istəyə bağlı)</label>
            <textarea className="field" rows={2} value={form.system_prompt || ""} onChange={set("system_prompt")} />
          </div>
          <div className="wide">
            <label className="lbl">Qeyd — nə ölçülür</label>
            <input className="field" value={form.guidance || ""} onChange={set("guidance")} />
            <p className="hint">Yalnız insanlar üçün: bu tapşırıq hansı bacarığı yoxlayır. Modelə göndərilmir.</p>
          </div>
          <div className="wide">
            <label className="pill" style={{ marginTop: 12 }}>
              <input type="checkbox" checked={!!form.enabled} onChange={set("enabled")} />
              aktivdir (dəstlərdə işə salınır)
            </label>
          </div>
        </div>

        {error ? <p className="error" style={{ marginTop: 12 }}>{error}</p> : null}
        <div className="editor-actions">
          <button className="btn" disabled={busy}>{busy ? "Yazılır…" : "Yadda saxla"}</button>
          <button type="button" className="btn ghost" onClick={() => router.push("/tasks")}>Ləğv et</button>
        </div>
      </div>
    </form>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<p className="spinner">Yüklənir…</p>}>
      <Editor />
    </Suspense>
  );
}
