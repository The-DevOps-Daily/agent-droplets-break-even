#!/usr/bin/env node
// Stage 3: for a measured cost per run, find the cheapest plan at each monthly
// volume, the break-even points, and the most each plan can save.
//
//   node scripts/03-break-even.mjs data/priced-2026-09.json [more priced files...]
import { readFileSync, writeFileSync } from "node:fs";
import { monthlyCost, PLANS } from "./prices.mjs";

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: node scripts/03-break-even.mjs data/priced-<period>.json ...");
  process.exit(1);
}

// Monthly list-price usage at which a plan starts to cost less than the one
// below it: Pro beats pay-as-you-go above its fee; Team beats Pro once Pro's
// overage (usage - 58.82, plus the $50 fee) passes Team's $200 fee.
const [payg, pro, team] = PLANS;
const proBreakEven = pro.fee;
const teamBreakEven = team.fee - pro.fee + pro.covers;
const maxSaving = { Pro: +(pro.covers - pro.fee).toFixed(2), Team: +(team.covers - team.fee).toFixed(2) };

const workloads = [];
for (const file of files) {
  const priced = JSON.parse(readFileSync(file, "utf8"));
  const r = priced.recordedRuns;
  if (r) {
    workloads.push({ name: `issue-to-PR run (${priced.period})`, perRun: r.billedPerRun, unit: "run" });
    if (r.billedPerMergedPullRequest) {
      workloads.push({ name: `merged pull request (${priced.period})`, perRun: r.billedPerMergedPullRequest, unit: "merged PR" });
    }
  }
  for (const w of priced.workloads ?? []) workloads.push(w);
}

const results = workloads.map((w) => ({
  ...w,
  proBreakEvenRuns: Math.ceil(proBreakEven / w.perRun),
  teamBreakEvenRuns: Math.ceil(teamBreakEven / w.perRun),
}));

// The cost curve for a chart: monthly list usage from $0 to $400.
const curve = [];
for (let usage = 0; usage <= 400; usage += 10) {
  curve.push({ usage, ...Object.fromEntries(PLANS.map((p) => [p.name, +monthlyCost(p, usage).toFixed(2)])) });
}

const out = { proBreakEvenUsage: proBreakEven, teamBreakEvenUsage: +teamBreakEven.toFixed(2), maxSaving, workloads: results, curve };
writeFileSync("data/break-even.json", `${JSON.stringify(out, null, 2)}\n`);
console.log(`Pro is cheaper than pay as you go above $${proBreakEven.toFixed(2)} of list-price usage a month; it saves at most $${maxSaving.Pro}.`);
console.log(`Team is cheaper than Pro above $${teamBreakEven.toFixed(2)}; it saves at most $${maxSaving.Team}.`);
const table = [
  ["workload", "cost per unit", "Pro pays off above", "Team beats Pro above"],
  ...results.map((r) => [r.name, `$${r.perRun}`, `${r.proBreakEvenRuns} ${r.unit}s/month`, `${r.teamBreakEvenRuns} ${r.unit}s/month`]),
];
const widths = table[0].map((_, i) => Math.max(...table.map((row) => row[i].length)));
console.log("");
for (const row of table) console.log(row.map((cell, i) => cell.padEnd(widths[i])).join("  ").trimEnd());
