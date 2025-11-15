# BGSUHackathon

FalconGraph Search — an AI-powered campus search prototype that builds a link graph of BGSU resources, stores page/PDF chunks in a vector index, and uses a RAG LLM pipeline to answer questions with grounded summaries and an interactive graph showing where answers came from.

## Virtual environment

Create a local Python virtual environment (if you don’t already have `bg-hack-env`) with:

```bash
python3 -m venv bg-hack-env
```

# BGSUHackathon

FalconGraph Search — an AI-powered campus search prototype that builds a link graph of BGSU resources, stores page/PDF chunks in a vector index, and uses a RAG LLM pipeline to answer questions with grounded summaries and an interactive graph showing where answers came from.

## Virtual environment

A Python virtual environment has been created for this project at:

```
./bg-hack-env
```

Activate it in zsh with:

```bash
source ./bg-hack-env/bin/activate
```

To deactivate:

```bash
deactivate
```

## Dependencies (Python backend)

A minimal `requirements.txt` is included with only the packages we need for the backend and ingestion during the hackathon. Install them (while the venv is activated) with:

```bash
pip install -r requirements.txt
```

Notes on PDFs / embeddings:

- We keep `PyMuPDF` for fast PDF text extraction. If you prefer `pdfplumber`, install it manually.
- For embeddings and LLM calls we recommend using the OpenAI API (the `openai` package). This avoids pulling large local ML stacks (PyTorch/Transformers) during the hackathon.

If you need a full pinned snapshot for reproducibility, I can produce `requirements-full.txt` (pip freeze).

## Frontend stack & quick start (Next.js + Tailwind + DaisyUI)

The frontend is a separate Node project (placed in `frontend/`). Below are the minimal commands to scaffold and run it.

1) Create the Next.js app

```bash
npx create-next-app@latest frontend
cd frontend
```

If you want TypeScript:

```bash
npx create-next-app@latest frontend --typescript
cd frontend
```

2) Install Tailwind CSS + PostCSS + Autoprefixer

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

3) Install DaisyUI

```bash
npm install daisyui
```

4) Update `tailwind.config.js` content paths and add DaisyUI plugin

```js
module.exports = {
	content: [
		"./pages/**/*.{js,ts,jsx,tsx}",
		"./app/**/*.{js,ts,jsx,tsx}",
		"./components/**/*.{js,ts,jsx,tsx}"
	],
	theme: { extend: {} },
	plugins: [require('daisyui')],
}
```

5) Add Tailwind directives to `styles/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

6) Run the dev server

```bash
npm run dev
# open http://localhost:3000
```

Notes about Node vs Python environments

- Frontend dependencies live in `frontend/package.json` and are installed with npm/pnpm/yarn (not pip).
- Add `frontend/node_modules/` to `.gitignore` (we already ignore general `node_modules/`).
- If teammates need a fast frontend setup, commit `package-lock.json` or `pnpm-lock.yaml` for reproducible installs.

## Quick start (backend)

Once dependencies are installed and the venv is activated, you can start a FastAPI server (after `backend/app.py` is created):

```bash
uvicorn backend.app:app --reload --port 8000
```

## Crawl BGSU content locally

Use `scripts/crawl_bgsu.py` to run the entire ingestion pipeline (crawl + graph build) in one step with baked-in defaults:

```bash
python scripts/crawl_bgsu.py
```

What happens when you run it:
- Crawls from `https://www.bgsu.edu`, respecting `robots.txt`, following links across the whitelisted BGSU domains, downloading HTML plus linked assets (PDFs, docs, JSON feeds, etc.), and storing everything under `data/raw/` (HTML in `data/raw/html/`, other assets in `data/raw/files/`, metadata logged to `data/raw/metadata.tsv`).
- Parses the downloaded HTML to extract nodes/edges, enriches nodes with doc type, title, word count, PageRank, betweenness, in/out degree, and depth-from-root metrics, and saves the processed graph to `data/processed/nodes.json` + `data/processed/edges.json`.

Need to tweak settings (domains, throttling, output paths, etc.)? Edit `config/pipeline.json`. The script automatically loads that file (or an alternate path via the `PIPELINE_CONFIG` environment variable) and applies the values to the pipeline—no CLI flags required.

Codex cannot access the public internet from this environment, so run the script locally on your machine with network access. Output directories resolve relative to the repo root so artifacts always land under `data/` (which is gitignored by default).

### Configuration file

- `config/pipeline.json` controls crawl/graph behavior (seed URL, allowed domains, throttling, output directories, extension whitelist, etc.).
- The script automatically reads this file; adjust values there instead of passing command-line flags.
- To use a different config file temporarily, set `PIPELINE_CONFIG=/path/to/custom.json` before running the script.

## Notes

- The venv directory `bg-hack-env` is excluded in `.gitignore` so it won't be committed.

We replaced the earlier full environment snapshot with a minimal `requirements.txt` to keep installs quick for teammates. If you need a pinned snapshot of exact versions for reproducible environments later, I can generate a full `pip freeze` into `requirements-full.txt`.

## Next steps

- Create the backend skeleton in `backend/` (FastAPI endpoints `/search` and `/summarize`).
- Add ingestion scripts under `scripts/` to build `nodes.json` / `edges.json` and a FAISS index.
- Scaffold the frontend in `frontend/` and wire it to the backend for queries and graph visualization.

See the project plan in the repository issues/todo for sprint-by-sprint tasks.
