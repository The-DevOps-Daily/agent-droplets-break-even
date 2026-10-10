// DigitalOcean list prices used by every stage, read 2026-10-10 from
// https://docs.digitalocean.com/products/managed-agents/agent-harness-runtime/details/pricing/
// https://docs.digitalocean.com/products/inference/details/pricing/
// https://www.digitalocean.com/pricing/agent-droplets
export const COMPUTE = { vcpuHour: 0.044, gbHour: 0.0095 };

// USD per 1M tokens.
export const MODELS = {
  "deepseek-v4-pro": { input: 1.74, output: 3.48, cacheRead: 0.348 },
  "kimi-k3": { input: 3.0, output: 15.0, cacheRead: 0.3 },
  "glm-5.3": { input: 1.4, output: 4.4, cacheRead: 0.26 },
};

// Agent Droplets: the monthly fee funds a balance worth `covers` of usage at
// list price. Past that, usage continues at list price.
export const PLANS = [
  { name: "Pay as you go", fee: 0, covers: 0 },
  { name: "Pro", fee: 50, covers: 58.82 },
  { name: "Team", fee: 200, covers: 250 },
];

export function monthlyCost(plan, listUsage) {
  return plan.fee + Math.max(0, listUsage - plan.covers);
}
