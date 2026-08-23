export const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function getKey() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("aztest_key") || "";
}

export async function api(path, opts = {}) {
  const res = await fetch(`${API}/api/v1${path}`, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "X-Az-Key": getKey(),
      ...(opts.headers || {}),
    },
  });
  if (res.status === 401) {
    window.location.href = `${BASE_PATH}/login`;
    throw new Error("unauthorized");
  }
  if (!res.ok) {
    let detail = await res.text();
    try {
      detail = JSON.parse(detail).detail || detail;
    } catch {}
    throw new Error(detail || `HTTP ${res.status}`);
  }
  return res.json();
}

export const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body) });
export const patch = (path, body) => api(path, { method: "PATCH", body: JSON.stringify(body) });
export const put = (path, body) => api(path, { method: "PUT", body: JSON.stringify(body) });
export const del = (path) => api(path, { method: "DELETE" });

// ---- formatting ----
export const fmtCost = (c) => `$${Number(c || 0).toFixed(4)}`;
export const fmtMs = (ms) => (ms >= 10000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms || 0)}ms`);
export const fmtNum = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString());

export function fmtWhen(ts) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("az-AZ", { dateStyle: "short", timeStyle: "short" });
}

// A run's wall clock: started -> completed, or now while it is still going.
export function elapsed(run) {
  if (!run?.started_at) return 0;
  const end = run.completed_at ? new Date(run.completed_at) : new Date();
  return end - new Date(run.started_at);
}

// 0-100 score tiers. Deliberately coarse: the useful question is
// "usable / needs an editor / unusable", not a fine ranking.
export function tier(score) {
  if (score === null || score === undefined) return "";
  if (score >= 75) return "tier-good";
  if (score >= 50) return "tier-mid";
  return "tier-bad";
}

export function runChip(status) {
  if (status === "RUNNING") return "chip run";
  if (status === "COMPLETED") return "chip pass";
  if (status === "FAILED") return "chip fail";
  if (status === "CANCELLED") return "chip warn";
  return "chip";
}

export const VERDICT_CHIP = {
  excellent: "chip pass",
  good: "chip pass",
  acceptable: "chip warn",
  weak: "chip fail",
  unusable: "chip fail",
};
