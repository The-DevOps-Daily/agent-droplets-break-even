#!/usr/bin/env node
// Stage 1: read one DigitalOcean invoice and keep only the Managed Agents lines
// (Harness Runtime compute, bandwidth and the model tokens billed per session).
// Writes data/invoice-<period>.json, which the next stage prices.
//
//   DIGITALOCEAN_ACCESS_TOKEN=... node scripts/01-invoice-lines.mjs <invoice-uuid>
//   DIGITALOCEAN_ACCESS_TOKEN=... node scripts/01-invoice-lines.mjs preview
import { writeFileSync } from "node:fs";

const token = process.env.DIGITALOCEAN_ACCESS_TOKEN;
const id = process.argv[2];
if (!token || !id) {
  console.error("usage: DIGITALOCEAN_ACCESS_TOKEN=... node scripts/01-invoice-lines.mjs <invoice-uuid|preview>");
  process.exit(1);
}

async function get(path) {
  const res = await fetch(`https://api.digitalocean.com/v2${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status} ${await res.text()}`);
  return res.json();
}

let uuid = id;
if (id === "preview") uuid = (await get("/customers/my/invoices?per_page=1")).invoice_preview.invoice_uuid;

const items = [];
for (let page = 1; ; page++) {
  const data = await get(`/customers/my/invoices/${uuid}?per_page=100&page=${page}`);
  items.push(...data.invoice_items);
  if (!data.links?.pages?.next) break;
}
const summary = await get(`/customers/my/invoices/${uuid}/summary`);

const AGENT_PRODUCTS = new Set(["OHS Compute", "Harness Runtime Serverless Inference", "Harness Runtime Bandwidth"]);
const lines = items
  .filter((i) => AGENT_PRODUCTS.has(i.product))
  .map((i) => ({
    product: i.product,
    description: i.description,
    session: i.group_description ?? null,
    amount: Number(i.amount),
    start: i.start_time,
    end: i.end_time,
  }));
const productTotals = Object.fromEntries(
  (summary.product_charges?.items ?? []).filter((p) => AGENT_PRODUCTS.has(p.name)).map((p) => [p.name, Number(p.amount)]),
);

const period = summary.billing_period;
const out = `data/invoice-${period}.json`;
writeFileSync(out, `${JSON.stringify({ period, productTotals, lines }, null, 2)}\n`);
console.log(`${out}: ${lines.length} Managed Agents lines`, productTotals);
