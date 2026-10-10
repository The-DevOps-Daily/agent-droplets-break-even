#!/usr/bin/env node
// Stage 2: price every session on an invoice two ways. "exact" is tokens times
// the list price; "billed" is what the invoice charged. The difference is the
// per-line rounding: each session's input, output and cache-read lines are
// billed in whole cents.
//
//   node scripts/02-price-sessions.mjs data/invoice-2026-09.json --runs data/recorded-runs-2026-09.json
//
// --runs maps invoice sessions to the recorded runs of the issue-to-PR repo and
// says which ended in a merged pull request.
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { COMPUTE } from "./prices.mjs";

const { values, positionals } = parseArgs({ allowPositionals: true, options: { runs: { type: "string" } } });
const file = positionals[0];
if (!file) {
  console.error("usage: node scripts/02-price-sessions.mjs data/invoice-<period>.json");
  process.exit(1);
}
const { period, productTotals, lines } = JSON.parse(readFileSync(file, "utf8"));

// Each token line on the invoice is the exact amount rounded to the cent, and
// never less than one cent. This checks that rule against every line.
const centRule = (exact) => Math.max(0.01, Math.round(exact * 100) / 100);
let ruleMatches = 0;
let ruleLines = 0;

const sessions = new Map();
const session = (name) => {
  if (!sessions.has(name)) {
    sessions.set(name, { session: name, tokens: {}, exact: 0, billed: 0, computeSeconds: 0, computeListCost: 0, computeBilled: 0, size: null });
  }
  return sessions.get(name);
};

for (const line of lines) {
  if (!line.session) continue;
  const s = session(line.session);
  if (line.product === "Harness Runtime Serverless Inference") {
    const m = /^(.+?) ((?:Cache Read )?Input|Output) tokens \(([\d,]+) @ \$([\d.]+)\/thousand\)$/.exec(line.description);
    if (!m) throw new Error(`unexpected line: ${line.description}`);
    const kind = { Input: "input", Output: "output", "Cache Read Input": "cacheRead" }[m[2]];
    const count = Number(m[3].replace(/,/g, ""));
    s.model = m[1];
    s.tokens[kind] = (s.tokens[kind] ?? 0) + count;
    const exact = (count / 1000) * Number(m[4]);
    s.exact += exact;
    s.billed += line.amount;
    ruleLines += 1;
    if (Math.abs(centRule(exact) - line.amount) < 1e-9) ruleMatches += 1;
  } else if (line.product === "OHS Compute") {
    const m = /(\d+) vCPU \/ (\d+)GB/.exec(line.description);
    const seconds = (Date.parse(line.end) - Date.parse(line.start)) / 1000;
    s.size = `${m[1]} vCPU / ${m[2]} GB`;
    s.computeSeconds += seconds;
    s.computeListCost += (seconds / 3600) * (Number(m[1]) * COMPUTE.vcpuHour + Number(m[2]) * COMPUTE.gbHour);
    s.computeBilled += line.amount;
  }
}

const rows = [...sessions.values()]
  .map((s) => ({ ...s, exact: +s.exact.toFixed(5), billed: +s.billed.toFixed(2), computeListCost: +s.computeListCost.toFixed(5) }))
  .sort((a, b) => a.session.localeCompare(b.session));
const sum = (xs, k) => xs.reduce((t, x) => t + x[k], 0);
const issueSessions = rows.filter((r) => r.session.startsWith("issue-"));
const out = {
  period,
  invoiceProductTotals: productTotals,
  sessions: rows,
  issueSessions: {
    count: issueSessions.length,
    exactModelCost: +sum(issueSessions, "exact").toFixed(4),
    billedModelCost: +sum(issueSessions, "billed").toFixed(2),
  },
};
if (values.runs) {
  const recorded = JSON.parse(readFileSync(values.runs, "utf8")).runs;
  const matched = recorded.map((r) => {
    const s = rows.find((x) => x.session === r.session);
    if (!s) throw new Error(`session ${r.session} is not on the invoice`);
    return { ...r, tokens: s.tokens, exact: s.exact, billed: s.billed, computeSeconds: s.computeSeconds, computeBilled: s.computeBilled };
  });
  const merged = matched.filter((r) => r.merged).length;
  out.recordedRuns = {
    runs: matched,
    count: matched.length,
    merged,
    exactModelCost: +sum(matched, "exact").toFixed(4),
    billedModelCost: +sum(matched, "billed").toFixed(2),
    computeBilled: +sum(matched, "computeBilled").toFixed(2),
    // Tokens plus compute, as billed. Storage, tools and egress were $0 here.
    billedPerRun: (sum(matched, "billed") + sum(matched, "computeBilled")) / matched.length,
    billedPerMergedPullRequest: merged ? (sum(matched, "billed") + sum(matched, "computeBilled")) / merged : null,
  };
}
out.roundingRule = { rule: "max(0.01, round(exact, 2)) per token line", lines: ruleLines, matches: ruleMatches };
out.allSessions = { exactModelCost: +sum(rows, "exact").toFixed(4), billedModelCost: +sum(rows, "billed").toFixed(2) };
const target = file.replace("invoice-", "priced-");
writeFileSync(target, `${JSON.stringify(out, null, 2)}\n`);
console.log(`${target}`);
console.table(rows.map((r) => ({ session: r.session, size: r.size, seconds: r.computeSeconds, ...r.tokens, exact: r.exact, billed: r.billed })));
console.log("issue sessions:", out.issueSessions);
if (out.recordedRuns) console.log("recorded runs:", { ...out.recordedRuns, runs: undefined });
console.log("all sessions:", out.allSessions, "invoice says:", productTotals);
console.log("rounding rule:", out.roundingRule);
