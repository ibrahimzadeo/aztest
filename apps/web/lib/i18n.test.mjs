// A dictionary rots quietly: a missed key renders as "group.key" in the UI and
// nobody notices until a customer does. These tests fail instead.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const src = readFileSync(path.join(here, "i18n.js"), "utf8");

// The dictionary is data, so read it out of the module source rather than
// importing (the module is a client component with React imports).
const body = src.slice(src.indexOf("const DICT = {"), src.indexOf("\nfunction lookup"));

function entries() {
  const found = [];
  const re = /^\s{4}([a-z_0-9]+):\s*\[([\s\S]*?)\],\s*$/gm;
  let m;
  while ((m = re.exec(body))) found.push([m[1], m[2]]);
  return found;
}

test("every dictionary entry has both languages", () => {
  const bad = entries().filter(([, value]) => {
    const strings = value.match(/"(?:[^"\\]|\\.)*"/g) || [];
    return strings.length !== 2;
  });
  assert.deepEqual(bad.map(([k]) => k), [], "entries missing a translation");
});

test("no entry leaves the English side identical to Azerbaijani prose", () => {
  // Identical strings are fine for names and symbols (Playground, Model, —)
  // but a long identical string means a forgotten translation.
  const suspicious = entries().filter(([, value]) => {
    const [az, en] = (value.match(/"(?:[^"\\]|\\.)*"/g) || []).map((s) => s.slice(1, -1));
    return az && en && az === en && az.length > 24;
  });
  assert.deepEqual(suspicious.map(([k]) => k), []);
});

test("no Azerbaijani-specific letters leak into the English side", () => {
  const leaked = entries().filter(([, value]) => {
    const strings = value.match(/"(?:[^"\\]|\\.)*"/g) || [];
    return strings.length === 2 && /[əğışüöç]/i.test(strings[1]);
  });
  assert.deepEqual(leaked.map(([k]) => k), []);
});

test("every t() key used in the app exists in the dictionary", () => {
  const keys = new Set();
  for (const [group] of body.matchAll(/^  (\w+): \{/gm)) keys.add(group);
  const defined = new Set();
  let currentGroup = null;
  for (const line of body.split("\n")) {
    const g = line.match(/^  (\w+): \{/);
    if (g) currentGroup = g[1];
    const e = line.match(/^    ([a-z_0-9]+):/);
    if (e && currentGroup) defined.add(`${currentGroup}.${e[1]}`);
  }

  const used = new Set();
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) {
        if (name !== "node_modules" && name !== ".next") walk(full);
      } else if (name.endsWith(".jsx")) {
        const text = readFileSync(full, "utf8");
        for (const m of text.matchAll(/\bt\("([a-z_0-9]+\.[a-z_0-9]+)"\)/g)) used.add(m[1]);
      }
    }
  };
  walk(path.join(here, "..", "app"));

  const missing = [...used].filter((k) => !defined.has(k)).sort();
  assert.deepEqual(missing, [], "keys used in the UI but absent from the dictionary");
  assert.ok(used.size > 100, `expected the UI to be translated, only ${used.size} keys used`);
});
