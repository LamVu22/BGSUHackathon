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

You can download raw site data with the experimental C++/OpenMP crawler located in `cpp/` (see details below). It stores everything under `data/raw/` (`html/`, `files/`, plus `metadata.tsv` mapping URLs to files) and reads the same `config/pipeline.json` values.

## C++/OpenMP crawler

If you want a highly parallel downloader, build the C++ crawler located in `cpp/` (requires Make, a C++20 compiler, libcurl, and OpenMP):

```bash
cd cpp
make         # builds ./bgsu_crawler
./bgsu_crawler
```

Key traits:
- Uses OpenMP to fan out across `crawler_threads` (defaults to hardware concurrency or read from `config/pipeline.json`).
- Stores data in the same `data/raw/` hierarchy (HTML under `html/`, assets under `files/`, metadata appended to `metadata.tsv`).
- Reads the same config file (start URL, allowed domains, extension whitelist, crawl limits, delay, etc.).
- Only handles downloading; continue to use the Python scripts (`build_graph.py`, etc.) to clean content and build the graph once the C++ crawler finishes.

This downloader replaces the old Python crawler. After it finishes, run the Python scripts (`link_map.py`, `build_graph.py`, etc.) to inspect links, clean content, and build the graph.

## Inspect link structure quickly

If you want a lightweight view of the site graph (unique URLs + edges) before downloading everything, run:

```bash
python scripts/link_map.py
```

This scanner performs a BFS but only collects link structure, writing stats and a simple edge list to `data/link_map.json` (configurable). Use it to gauge how many unique URLs the crawler will eventually hit.

## Clean content & build the graph

After crawling, run `scripts/build_graph.py` to parse the downloaded HTML, clean the text, extract link structure, and compute graph metrics:

```bash
python scripts/build_graph.py
```

What this step does:
- Reads `data/raw/metadata.tsv` and every saved HTML file
- Strips scripts/styles/boilerplate, stores cleaned text and snippets on each node
- Builds the directed graph (nodes + edges) and computes word counts, in/out degree, PageRank, betweenness, and depth-from-root metrics
- Saves JSON outputs to `data/processed/nodes.json` and `data/processed/edges.json`

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
