#!/usr/bin/env python3
"""
Build FAISS embeddings for nodes.json so we can serve RAG locally.

Prerequisites (install inside the venv you use for the project):

    pip install sentence-transformers faiss-cpu

Usage (run from repo root, after clean_content/build_graph have produced data/processed/nodes.json):

    python scripts/embed_nodes.py \
        --model all-MiniLM-L6-v2 \
        --nodes data/processed/nodes.json \
        --index data/processed/faiss.index \
        --mapping data/processed/node_mapping.json
"""

from __future__ import annotations

import argparse
import json
import logging
import os
from pathlib import Path

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

REPO_ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Embed nodes.json into a local FAISS index.")
    parser.add_argument(
        "--nodes",
        default=REPO_ROOT / "data/processed/nodes.json",
        type=Path,
        help="Path to enriched nodes.json (output of build_graph.py)",
    )
    parser.add_argument(
        "--index",
        default=REPO_ROOT / "data/processed/faiss.index",
        type=Path,
        help="Path to write the FAISS index",
    )
    parser.add_argument(
        "--mapping",
        default=REPO_ROOT / "data/processed/node_mapping.json",
        type=Path,
        help="JSON file mapping FAISS row ids -> node metadata (url/title/snippet)",
    )
    parser.add_argument(
        "--model",
        default="sentence-transformers/paraphrase-MiniLM-L6-v2",
        help="SentenceTransformer model name (use a smaller/quantized model if you need more speed)",
    )
    parser.add_argument("--batch-size", type=int, default=64, help="Batch size for encoding")
    parser.add_argument("--device", default="mps", help="Device to use (cpu, cuda, mps)")
    return parser.parse_args()


def load_nodes(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"nodes.json not found at {path}. Run build_graph.py first.")
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    logging.info("Loaded %s nodes from %s", len(data), path)
    return data


def make_payload(node: dict) -> str:
    title = node.get("title") or node["url"]
    snippet = node.get("snippet") or ""
    doc_type = node.get("doc_type") or ""
    depth = node.get("metrics", {}).get("depth_from_root")
    depth_txt = f"Depth: {depth}." if depth is not None else ""
    return f"{title}\n{doc_type} {depth_txt}\n{snippet}\n{node.get('clean_text','')}"


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

    nodes = load_nodes(args.nodes)
    texts = [make_payload(node) for node in nodes]

    logging.info("Loading embedding model: %s (device=%s)", args.model, args.device)
    model = SentenceTransformer(args.model, device=args.device)

    logging.info("Encoding %s nodes (batch=%s) on %s", len(texts), args.batch_size, args.device)
    embeddings = model.encode(
        texts,
        batch_size=args.batch_size,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
    ).astype("float32")

    dim = embeddings.shape[1]
    logging.info("Embedding dimension: %s", dim)
    index = faiss.IndexFlatIP(dim)  # cosine similarity (since vectors are normalized)
    index.add(embeddings)

    args.index.parent.mkdir(parents=True, exist_ok=True)
    faiss.write_index(index, str(args.index))
    logging.info("Wrote FAISS index to %s", args.index)

    mapping = []
    for row_id, node in enumerate(nodes):
        mapping.append(
            {
                "row_id": row_id,
                "url": node["url"],
                "title": node.get("title"),
                "snippet": node.get("snippet"),
                "metrics": node.get("metrics", {}),
            }
        )

    args.mapping.parent.mkdir(parents=True, exist_ok=True)
    with args.mapping.open("w", encoding="utf-8") as f:
        json.dump(mapping, f, indent=2)
    logging.info("Wrote node mapping (%s rows) to %s", len(mapping), args.mapping)


if __name__ == "__main__":
    main()
