# BGSUHackathon

FalconGraph Search — an AI-powered campus search prototype that builds a link graph of BGSU resources, stores page/PDF chunks in a vector index, and uses a RAG LLM pipeline to answer questions with grounded summaries and an interactive graph showing where answers came from.

## Virtual environment (Python backend)

Create (or reuse) a virtual environment at the repo root:

```bash
python3 -m venv bg-hack-env
source ./bg-hack-env/bin/activate
```

Deactivate with `deactivate` when you are done. The directory `bg-hack-env/` is already gitignored.

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
- To enable Gemini RAG, copy `frontend/.env.local.example` to `frontend/.env.local` and add `GEMINI_API_KEY=...` (and optionally `GEMINI_MODEL=gemini-1.5-flash-latest`). The `/api/search` route crawls bgsu.edu, calls Gemini, and the search UI invokes that route for every query.

## Quick start (backend)

Once dependencies are installed and the venv is activated, you can start a FastAPI server (after `backend/app.py` is created):

```bash
uvicorn backend.app:app --reload --port 8000
```

## Crawl BGSU content (C++ downloader)

The parallel crawler lives in `cpp/` and replaces the earlier Python script. It reads `config/pipeline.json`, runs multiple threads (OpenMP), and saves downloads under `data/raw/` (`html/`, `files/`, `metadata.tsv`).

Prerequisites (macOS/Homebrew example):

```bash
brew install gcc libcurl        # installs g++-14 with OpenMP support
```

Build and run (from repo root):

```bash
cd cpp
CXX=g++-14 make          # or set CXX to whichever compiler has OpenMP
./bgsu_crawler           # run from repo root or any subdir; the binary walks up to find config/pipeline.json
```

Key traits:
- Uses OpenMP to fan out across `crawler_threads` (defaults to hardware concurrency or the value in `config/pipeline.json`).
- Avoids duplicate work via shared `visited`/`queued` sets, so threads never fetch the same link twice.
- Stops when the queue empties; set `max_pages` in the config if you want a finite crawl.
- Downloads only (no cleaning); run the Python scripts below afterward.

## Clean content (HTML, PDFs, docs, spreadsheets)

After crawling, run the cleaning step to extract text/snippets and link structure (multi-threaded, with periodic checkpoints):

```bash
python scripts/clean_content.py
```

This generates/updates `data/processed/clean_nodes.json` and `data/processed/clean_edges.json`, where each node already contains cleaned text/snippets (from HTML pages plus PDFs/DOCX files), document metadata, and each edge records anchor text between source→target URLs. Progress logs appear every ~50 files, and checkpoints are written so you don’t lose work if interrupted.

## Inspect link structure quickly

If you want a lightweight view of the site graph (unique URLs + edges) before downloading everything, run:

```bash
python scripts/link_map.py
```

This scanner performs a BFS but only collects link structure, writing stats and a simple edge list to `data/link_map.json` (configurable). Use it to gauge how many unique URLs the crawler will eventually hit.

## Clean content & build the graph

Once `clean_content.py` has produced the intermediate JSON files, build the graph metrics:

```bash
python scripts/build_graph.py
```

What this step does:
- Consumes `data/processed/clean_nodes.json` + `clean_edges.json`
- Rebuilds the directed graph (adds any missing nodes referenced by edges) and saves the normalized `nodes.json` / `edges.json` outputs without computing expensive metrics (PageRank, betweenness, etc.). Use these files as the source of truth for downstream indexing or vector search.

## Create local embeddings (optional)

To index the graph for retrieval, install embedding + FAISS dependencies and run:

```bash
source ./bg-hack-env/bin/activate
pip install sentence-transformers faiss-cpu
python scripts/embed_nodes.py
```

This script reads `data/processed/nodes.json`, encodes each node with `all-MiniLM-L6-v2`, and writes `data/processed/faiss.index` plus `node_mapping.json`, so you can serve vector search locally.

## Configuration file

- `config/pipeline.json` controls all ingestion utilities (seed URL, allowed domains, throttling, output directories, extension whitelist, snippet length, `crawler_threads`, link-map output path, etc.).
- Each script automatically reads this file; adjust values there instead of passing command-line flags.
- To use a different config file temporarily, set `PIPELINE_CONFIG=/path/to/custom.json` before running the scripts.

Codex cannot access the public internet from this environment, so run the crawler locally on your machine with network access. Output directories resolve relative to the repo root so artifacts always land under `data/` (which is gitignored by default).

## Notes

- The venv directory `bg-hack-env` is excluded in `.gitignore` so it won't be committed.

We replaced the earlier full environment snapshot with a minimal `requirements.txt` to keep installs quick for teammates. If you need a pinned snapshot of exact versions for reproducible environments later, I can generate a full `pip freeze` into `requirements-full.txt`.

## Next steps

- Create the backend skeleton in `backend/` (FastAPI endpoints `/search` and `/summarize`).
- Add ingestion scripts under `scripts/` to build `nodes.json` / `edges.json` and a FAISS index.
- Scaffold the frontend in `frontend/` and wire it to the backend for queries and graph visualization.

See the project plan in the repository issues/todo for sprint-by-sprint tasks.

## Create local embeddings (optional)

To index the graph for retrieval, install embedding + FAISS dependencies and run:

```bash
source ./bg-hack-env/bin/activate
pip install sentence-transformers faiss-cpu
python scripts/embed_nodes.py --device cpu --batch-size 128
```

This script reads `data/processed/nodes.json`, encodes each node with `all-MiniLM-L6-v2`, and writes `data/processed/faiss.index` plus `node_mapping.json`, so you can serve vector search locally.
