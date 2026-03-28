# Family office IC agent

Next.js app for a small **investment committee** workflow: create a case, attach a thesis and documents (and optional research URLs), then run an analysis pipeline that produces an IC-style memo and a **structured decision** (JSON). **Policy rules** in YAML are evaluated deterministically; **hard constraint breaches** prevent an `approve` recommendation even if the model suggests it.

## Features

- Case CRUD via UI and `/api/cases`
- File uploads with excerpts for text-like formats (txt, md, csv, json)
- Pipeline: research → extract → underwrite → policy check → decide (+ audit trail in SQLite)
- Optional OpenAI for extract/decide; deterministic fallbacks without `OPENAI_API_KEY`

## Requirements

- **Node.js** (tested with Node 23)
- **npm** (or compatible client)

## Quick start

```bash
git clone git@github.com:rohitsundaram/Family-office-IC-agent.git
cd Family-office-IC-agent
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | No | Enables LLM extraction and decision/memo generation |

```bash
export OPENAI_API_KEY="sk-..."
```

You can also use a `.env.local` file (Next.js loads it automatically; never commit secrets).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server (Turbopack) |
| `npm run build` | Production build |
| `npm start` | Run production server (after `build`) |
| `npm test` | Vitest unit tests |
| `npm run lint` | ESLint |

## Using the app

1. **Create a case** on the home page (asset type, optional title, optional thesis).
2. Open **`/cases/{id}`**, **upload** files, then click **Analyze**.
3. Review latest analysis summary and JSON output in the UI.

Data is stored under **`.data/`** (SQLite + uploads), gitignored.

## Sample data

Example `inputs` payloads: **`datasets/cases/`** (`pe_vc`, `public_equities`, `real_estate` samples). Paste JSON into the thesis field or add an import in the UI later.

## Project layout

| Area | Path |
|------|------|
| Pages & API routes | `app/` |
| Client components | `components/` |
| SQLite access | `lib/sqlite.ts` |
| Analysis pipeline | `lib/pipeline/` (`steps/` for each stage) |
| Policy (YAML + engine) | `lib/policy/` |
| Zod models | `lib/models/` |

Legacy paths **`/case/:id`** and **`/api/case/...`** redirect/rewrite to **`/cases/...`** and **`/api/cases/...`** (see `next.config.ts`).

## Stack

Next.js 16, React 19, TypeScript, better-sqlite3, Zod, OpenAI SDK (optional), Vitest.
