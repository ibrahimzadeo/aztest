"use client";

import { tier } from "@/lib/api";

// One score renderer everywhere, so a 0-100 number always reads the same way
// and always shows the digits next to the bar.
export default function Score({ value, width = 108, suffix = "" }) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return <span className="score" style={{ minWidth: width }}><span className="none">—</span></span>;
  }
  const v = Math.max(0, Math.min(100, Number(value)));
  const t = tier(v);
  return (
    <span className={`score ${t}`} style={{ minWidth: width }}>
      <span className={`num ${t}`}>{v.toFixed(0)}{suffix}</span>
      <span className="bar"><i style={{ width: `${v}%` }} /></span>
    </span>
  );
}
