"use client";

import { useState } from "react";
import { BASE_PATH } from "@/lib/api";

export default function Login() {
  const [key, setKey] = useState("");
  return (
    <div className="card" style={{ maxWidth: 420, margin: "60px auto" }}>
      <div className="eyebrow"><span className="dot" /> AzTest</div>
      <h2>Giriş açarı</h2>
      <p className="card-desc">
        Paylaşılan açarı daxil et. Açar yalnız bu brauzerdə saxlanılır.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          localStorage.setItem("aztest_key", key.trim());
          window.location.href = `${BASE_PATH}/`;
        }}
      >
        <label className="lbl">API açarı</label>
        <input
          className="field"
          type="password"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          style={{ width: "100%" }}
          autoFocus
        />
        <div className="editor-actions">
          <button className="btn" type="submit">Daxil ol</button>
        </div>
      </form>
    </div>
  );
}
