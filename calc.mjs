#!/usr/bin/env node
// Which Agent Droplets plan is cheapest for you? Give your own numbers, as
// list prices for usage the plans discount: compute, memory, storage, tools,
// egress and DigitalOcean-hosted models. Put Claude, GPT and other charges the
// plans do not discount in --other; they are added unchanged to every plan.
//
//   node calc.mjs --runs 500 --cost 0.07              # 500 runs a month at $0.07 each
//   node calc.mjs --usage 120                         # $120 a month of eligible usage
//   node calc.mjs --usage 120 --other 300             # plus $300 of Claude tokens
import { parseArgs } from "node:util";
import { monthlyCost, PLANS } from "./scripts/prices.mjs";

const { values } = parseArgs({ options: { runs: { type: "string" }, cost: { type: "string" }, usage: { type: "string" }, other: { type: "string" } } });
const usage = values.usage ? Number(values.usage) : Number(values.runs) * Number(values.cost);
if (!Number.isFinite(usage) || usage < 0) {
  console.error("usage: node calc.mjs --runs N --cost USD   or   node calc.mjs --usage USD");
  process.exit(1);
}
const other = Number(values.other ?? 0);
if (!Number.isFinite(other) || other < 0) {
  console.error("--other must be a number of dollars");
  process.exit(1);
}
const costs = PLANS.map((p) => ({ plan: p.name, monthly: +(monthlyCost(p, usage) + other).toFixed(2) }));
const best = costs.reduce((a, b) => (b.monthly < a.monthly ? b : a));
console.log(`Discount-eligible usage at list price: $${usage.toFixed(2)} a month${other ? `, plus $${other.toFixed(2)} the plans do not discount` : ""}`);
for (const c of costs) console.log(`  ${c.plan.padEnd(14)} $${c.monthly.toFixed(2)}`);
console.log(`Cheapest: ${best.plan}.`);
