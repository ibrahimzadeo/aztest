"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, post, put } from "@/lib/api";

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [key, setKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [judge, setJudge] = useState({ enabled: true, model: "", max_output_tokens: 2000, input_price_per_m: 0, output_price_per_m: 0 });
  const [defaults, setDefaults] = useState({ concurrency: 3, temperature: 0.7, max_output_tokens: 1500 });
  const [models, setModels] = useState([]);
  const [probe, setProbe] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api("/settings")
      .then((s) => {
        setSettings(s);
        setBaseUrl(s.provider.base_url);
        setJudge(s.judge);
        setDefaults(s.defaults);
      })
      .catch((e) => setError(e.message));
    api("/models").then((d) => setModels(d.models)).catch(() => {});
  }, []);

  async function save(path, body, label) {
    setError("");
    setMsg("");
    try {
      const s = await put(path, body);
      setSettings(s);
      setMsg(`${label} yadda saxlanıldı.`);
      if (path.endsWith("/provider")) setKey("");
    } catch (e) {
      setError(e.message);
    }
  }

  async function runProbe() {
    setProbe({ loading: true });
    try {
      setProbe(await post("/settings/probe", {}));
    } catch (e) {
      setProbe({ ok: false, error: e.message });
    }
  }

  if (!settings) return <p className="spinner">Yüklənir…</p>;

  return (
    <div className="settings">
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> Parametrlər</div>
        <h1>Provayder, hakim və run defoltları</h1>
        <p className="lede">
          Bütün parametrlər bazada saxlanılır — deploy zamanı env dəyişənləri yalnız ilk
          dəfə üçün ehtiyat variantdır. API açarı şifrələnmiş saxlanılır və heç vaxt geri
          oxunmur, yalnız maskalanmış formada göstərilir.
        </p>
      </div>

      {msg ? <p className="hint">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="card primary">
        <h2>Provayder — Nexum Router</h2>
        <p className="card-desc">
          OpenAI-uyğun endpoint. Model kodları prefiksiz yazılır (məsələn <span className="mono">deepseek-v4</span>).
          Nexum sabit həftəlik ödənişlidir, ona görə token qiymətlərini əl ilə təyin etmək lazımdır
          (yoxsa xərc hesabatı 0 göstərir).
        </p>
        <label className="lbl">Base URL</label>
        <input className="field mono" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={{ width: "100%" }} />
        <label className="lbl">API açarı</label>
        <input
          className="field"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={settings.provider.has_key ? `saxlanılıb: ${settings.provider.key_masked}` : "açar təyin edilməyib"}
          style={{ width: "100%" }}
        />
        <p className="hint">Boş buraxsan, mövcud açar dəyişmir.</p>
        <div className="actions">
          <button
            className="btn"
            onClick={() => save("/settings/provider", { base_url: baseUrl, ...(key ? { api_key: key } : {}) }, "Provayder")}
          >
            Yadda saxla
          </button>
          <button className="btn ghost" onClick={runProbe}>Bağlantını yoxla</button>
        </div>
        {probe ? (
          probe.loading ? (
            <div className="probe">Yoxlanılır… (/models cavabı 20 saniyəyə qədər çəkə bilər)</div>
          ) : probe.ok ? (
            <div className="probe ok">
              Bağlantı işləyir — {probe.model_count} model mövcuddur.{" "}
              <Link href="/settings/models" style={{ color: "var(--accent)" }}>Kataloqa keç</Link>
            </div>
          ) : (
            <div className="probe bad">Alınmadı: {probe.error}</div>
          )
        ) : null}
      </div>

      <div className="card">
        <h2>Hakim (LLM judge)</h2>
        <p className="card-desc">
          Hakim hər cavabı Azərbaycan dilində rubrika üzrə qiymətləndirir. Prompt Azərbaycan
          dilindədir və nəticə strukturlaşdırılmış JSON kimi qaytarılır.
        </p>
        <label className="lbl">Hakim modeli</label>
        <select className="field" value={judge.model} onChange={(e) => setJudge({ ...judge, model: e.target.value })}>
          <option value="">— seçilməyib —</option>
          {models.map((m) => <option key={m.model_id} value={m.model_id}>{m.label || m.model_id}</option>)}
        </select>
        <p className="hint">
          Hakim öz cavabını da qiymətləndirdiyi üçün nəticələrə meyl (self-preference) düşə bilər —
          kor qiymətləndirmə ilə yoxlamaq tövsiyə olunur.
        </p>
        <div className="prices">
          <label>
            Maks. output token
            <input className="field" type="number" value={judge.max_output_tokens}
                   onChange={(e) => setJudge({ ...judge, max_output_tokens: +e.target.value })} />
          </label>
          <label>
            Input $/1M
            <input className="field" type="number" step="0.01" value={judge.input_price_per_m}
                   onChange={(e) => setJudge({ ...judge, input_price_per_m: +e.target.value })} />
          </label>
          <label>
            Output $/1M
            <input className="field" type="number" step="0.01" value={judge.output_price_per_m}
                   onChange={(e) => setJudge({ ...judge, output_price_per_m: +e.target.value })} />
          </label>
        </div>
        <label className="pill">
          <input type="checkbox" checked={!!judge.enabled} onChange={(e) => setJudge({ ...judge, enabled: e.target.checked })} />
          yeni runlarda hakim defolt olaraq işləsin
        </label>
        <div className="actions">
          <button className="btn" onClick={() => save("/settings/judge", judge, "Hakim")}>Yadda saxla</button>
        </div>
      </div>

      <div className="card">
        <h2>Run defoltları</h2>
        <div className="prices">
          <label>
            Paralellik
            <input className="field" type="number" min="1" max="10" value={defaults.concurrency}
                   onChange={(e) => setDefaults({ ...defaults, concurrency: +e.target.value })} />
          </label>
          <label>
            Temperature
            <input className="field" type="number" step="0.1" value={defaults.temperature ?? 0.7}
                   onChange={(e) => setDefaults({ ...defaults, temperature: +e.target.value })} />
          </label>
          <label>
            Maks. output token
            <input className="field" type="number" value={defaults.max_output_tokens}
                   onChange={(e) => setDefaults({ ...defaults, max_output_tokens: +e.target.value })} />
          </label>
        </div>
        <div className="caveat">
          <strong>Düşünən (thinking) modellər:</strong> onlar cavabı yazmağa başlamadan
          əvvəl minlərlə token “düşünməyə” xərcləyir. Maks output token az olsa, model
          heç nə qaytarmır — bu, pis yazı deyil, konfiqurasiya problemidir və nəticələrdə
          “xəta” kimi göstərilir. Belə modellər üçün Modellər səhifəsində fərdi, daha
          böyük hədd təyin et.
        </div>
        <div className="caveat">
          <strong>Paralellik {settings.safe_concurrency}-dən yuxarı qaldırılmamalıdır:</strong> Nexum
          Router 4 eyni vaxtlı sorğuda HTTP 429 qaytarır. Worker hər halda öz həddini tətbiq edir,
          amma 429-lar cavabları xətaya çevirib nəticələri təhrif edir.
        </div>
        <div className="actions">
          <button className="btn" onClick={() => save("/settings/defaults", defaults, "Defoltlar")}>Yadda saxla</button>
        </div>
      </div>
    </div>
  );
}
