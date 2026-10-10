#!/usr/bin/env node
// Which Agent Droplets plan is cheapest for you? Give your own numbers:
//
//   node calc.mjs --runs 500 --cost 0.07       # 500 runs a month at $0.07 each
//   node calc.mjs --usage 120                  # $120 a month of usage at list price
import { parseArgs } from "node:util";
import { monthlyCost, PLANS } from "./scripts/prices.mjs";

const { values } = parseArgs({ options: { runs: { type: "string" }, cost: { type: "string" }, usage: { type: "string" } } });
const usage = values.usage ? Number(values.usage) : Number(values.runs) * Number(values.cost);
if (!Number.isFinite(usage) || usage < 0) {
  console.error("usage: node calc.mjs --runs N --cost USD   or   node calc.mjs --usage USD");
  process.exit(1);
}
const costs = PLANS.map((p) => ({ plan: p.name, monthly: +monthlyCost(p, usage).toFixed(2) }));
const best = costs.reduce((a, b) => (b.monthly < a.monthly ? b : a));
console.log(`List-price usage: $${usage.toFixed(2)} a month`);
for (const c of costs) console.log(`  ${c.plan.padEnd(14)} $${c.monthly.toFixed(2)}`);
console.log(`Cheapest: ${best.plan}. Only usage on DigitalOcean-hosted models, compute, storage, tools and egress is discounted; Claude and GPT are not.`);
