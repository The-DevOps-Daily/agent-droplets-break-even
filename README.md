# agent-droplets-break-even

When does a DigitalOcean Agent Droplets plan cost less than paying as you go? This repo prices real Managed Agents runs from a real DigitalOcean invoice, and works out the break-even for the Pro ($50) and Team ($200) plans.

```bash
node calc.mjs --runs 500 --cost 0.064     # your runs a month and cost per run
node calc.mjs --usage 120                 # or your monthly usage at list price
```

No dependencies: Node 20 or later.

## The result

- Pro costs $50 and covers $58.82 of usage at list price. It is cheaper than pay as you go only above **$50 a month** of discounted usage, and it saves at most **$8.82**.
- Team costs $200 and covers $250. It beats Pro only above **$208.82 a month**, and it saves at most **$50** against pay as you go.
- Our five recorded issue-to-PR runs were billed **$0.064 per run** ($0.107 per merged pull request). At that rate, Pro pays off above **782 runs a month**.
- The invoice rounds every token line of every session to the cent, with a one-cent minimum. Our five runs were billed $0.32 for tokens worth $0.274 at exact list prices.

The write-up: [DigitalOcean Agent Droplets: when the plan pays off](https://devops-daily.com/posts/digitalocean-agent-droplets-when-the-plan-pays-off).

## The stages

Each stage writes a file that the next one reads, so you can rerun any of them.

| Script | Reads | Writes |
| --- | --- | --- |
| `scripts/01-invoice-lines.mjs <invoice-uuid\|preview>` | the DigitalOcean billing API (`DIGITALOCEAN_ACCESS_TOKEN` with billing read) | `data/invoice-<period>.json`: only the Managed Agents lines |
| `scripts/02-price-sessions.mjs data/invoice-<period>.json --runs <runs.json>` | stage 1, plus a map of sessions to recorded runs | `data/priced-<period>.json`: exact and billed cost per session, and a check of the rounding rule against every line |
| `scripts/03-break-even.mjs data/priced-<period>.json` | stage 2 | `data/break-even.json`: break-even points per workload, and the plan cost curve |
| `scripts/04-long-session.sh` | `long-session/agent.yaml`, `long-session/tasks.txt` | `long-session/run/`: one longer session, six prompts, every answer and the timings. **Costs real money** (about a dollar). |
| `calc.mjs` | your numbers | the cheapest plan |

List prices are in [`scripts/prices.mjs`](scripts/prices.mjs), with the pages they come from and the date we read them.

## What is in `data/`

- `invoice-2026-09.json`: the 47 Managed Agents lines from our September 2026 invoice. The sessions are the runs from [do-agent-issue-to-pr](https://github.com/The-DevOps-Daily/do-agent-issue-to-pr) plus a few probes. The account's credits paid the invoice; the line amounts are the list-price charges before credits.
- `recorded-runs-2026-09.json`: which invoice session is which recorded run, from each run's `timeline.log`.
- `priced-2026-09.json` and `break-even.json`: the outputs of stages 2 and 3.

## What this does not tell you

- **Whether unused plan balance rolls over.** DigitalOcean's docs did not say when we checked (2026-10-10). If it expires each month, a quiet month costs the full fee.
- **Whether the plan changes the rounding.** Our invoice is pay as you go. We did not subscribe, so we do not know how a plan invoice shows the discount.
- **Claude or GPT costs.** Third-party models are not discounted by the plans. Our runs used DeepSeek V4 Pro and GLM-5.3, which DigitalOcean hosts.
- **Speed.** Managed Agents is in public preview, and the preview terms treat benchmark results as confidential. This repo only prices usage.

## License

MIT
