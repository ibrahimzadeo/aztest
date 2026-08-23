"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, post, put } from "@/lib/api";
import { useLang } from "@/lib/i18n";

export default function Settings() {
  const { t } = useLang();
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
      setMsg(`${label} ${t("settings.saved")}`);
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

  if (!settings) return <p className="spinner">{t("common.loading")}</p>;

  return (
    <div className="settings">
      <div className="hero">
        <div className="eyebrow"><span className="dot" /> {t("settings.eyebrow")}</div>
        <h1>{t("settings.h1")}</h1>
        <p className="lede">{t("settings.lede")}</p>
      </div>

      {msg ? <p className="hint">{msg}</p> : null}
      {error ? <p className="error">{error}</p> : null}

      <div className="card primary">
        <h2>{t("settings.provider_h")}</h2>
        <p className="card-desc">{t("settings.provider_desc")}</p>
        <label className="lbl">Base URL</label>
        <input className="field mono" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={{ width: "100%" }} />
        <label className="lbl">{t("settings.api_key")}</label>
        <input
          className="field"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={settings.provider.has_key ? `${t("settings.key_stored")} ${settings.provider.key_masked}` : t("settings.key_unset")}
          style={{ width: "100%" }}
        />
        <p className="hint">{t("settings.key_hint")}</p>
        <div className="actions">
          <button
            className="btn"
            onClick={() =>
              save("/settings/provider", { base_url: baseUrl, ...(key ? { api_key: key } : {}) },
                   t("settings.provider_h"))
            }
          >
            {t("common.save")}
          </button>
          <button className="btn ghost" onClick={runProbe}>{t("settings.test")}</button>
        </div>
        {probe ? (
          probe.loading ? (
            <div className="probe">{t("settings.testing")}</div>
          ) : probe.ok ? (
            <div className="probe ok">
              {t("settings.probe_ok")} {probe.model_count} {t("settings.probe_models")}{" "}
              <Link href="/settings/models" style={{ color: "var(--accent)" }}>
                {t("settings.probe_catalog")}
              </Link>
            </div>
          ) : (
            <div className="probe bad">{t("settings.probe_fail")} {probe.error}</div>
          )
        ) : null}
      </div>

      <div className="card">
        <h2>{t("settings.judge_h")}</h2>
        <p className="card-desc">{t("settings.judge_desc")}</p>
        <label className="lbl">{t("settings.judge_model")}</label>
        <select className="field" value={judge.model} onChange={(e) => setJudge({ ...judge, model: e.target.value })}>
          <option value="">{t("settings.unset")}</option>
          {models.map((m) => <option key={m.model_id} value={m.model_id}>{m.label || m.model_id}</option>)}
        </select>
        <p className="hint">{t("settings.judge_bias_hint")}</p>
        <div className="prices">
          <label>
            {t("settings.max_out")}
            <input className="field" type="number" value={judge.max_output_tokens}
                   onChange={(e) => setJudge({ ...judge, max_output_tokens: +e.target.value })} />
          </label>
          <label>
            {t("settings.in_price")}
            <input className="field" type="number" step="0.01" value={judge.input_price_per_m}
                   onChange={(e) => setJudge({ ...judge, input_price_per_m: +e.target.value })} />
          </label>
          <label>
            {t("settings.out_price")}
            <input className="field" type="number" step="0.01" value={judge.output_price_per_m}
                   onChange={(e) => setJudge({ ...judge, output_price_per_m: +e.target.value })} />
          </label>
        </div>
        <label className="pill">
          <input type="checkbox" checked={!!judge.enabled} onChange={(e) => setJudge({ ...judge, enabled: e.target.checked })} />
          {t("settings.judge_default")}
        </label>
        <div className="actions">
          <button className="btn" onClick={() => save("/settings/judge", judge, t("common.judge"))}>
            {t("common.save")}
          </button>
        </div>
      </div>

      <div className="card">
        <h2>{t("settings.defaults_h")}</h2>
        <div className="prices">
          <label>
            {t("suites.concurrency")}
            <input className="field" type="number" min="1" max="10" value={defaults.concurrency}
                   onChange={(e) => setDefaults({ ...defaults, concurrency: +e.target.value })} />
          </label>
          <label>
            {t("settings.temperature")}
            <input className="field" type="number" step="0.1" value={defaults.temperature ?? 0.7}
                   onChange={(e) => setDefaults({ ...defaults, temperature: +e.target.value })} />
          </label>
          <label>
            {t("settings.max_out")}
            <input className="field" type="number" value={defaults.max_output_tokens}
                   onChange={(e) => setDefaults({ ...defaults, max_output_tokens: +e.target.value })} />
          </label>
        </div>
        <div className="caveat">
          <strong>{t("settings.thinking_note_label")}</strong> {t("settings.thinking_note")}
        </div>
        <div className="caveat">
          <strong>
            {t("settings.concurrency_note_label")} {settings.safe_concurrency}
          </strong>{" "}
          {t("settings.concurrency_note")}
        </div>
        <div className="actions">
          <button className="btn" onClick={() => save("/settings/defaults", defaults, t("settings.defaults_h"))}>
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
