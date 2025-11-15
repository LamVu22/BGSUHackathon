#!/usr/bin/env python3
"""
Graph builder and content cleaner for crawled BGSU data.

Reads data/raw/metadata.tsv (produced by scripts/crawl_bgsu.py), parses HTML
files to extract clean text and link structure, computes graph metrics, and
emits data/processed/nodes.json + edges.json.

Usage (run from repo root with venv activated):

    python scripts/build_graph.py

Configuration lives in config/pipeline.json (or override with PIPELINE_CONFIG).
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Tuple
from urllib.parse import urljoin, urlparse

import networkx as nx
from bs4 import BeautifulSoup

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = REPO_ROOT / "config" / "pipeline.json"


@dataclass
class GraphSettings:
    raw_output: Path = REPO_ROOT / "data/raw"
    processed_output: Path = REPO_ROOT / "data/processed"
    allowed_domains: List[str] = field(default_factory=lambda: ["www.bgsu.edu", "bgsu.edu"])
    root_url: str = "https://www.bgsu.edu"
    snippet_chars: int = 600

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "GraphSettings":
        default = cls()

        def get_value(key: str, fallback):
            return data.get(key, fallback) if isinstance(data, dict) else fallback

        raw_output = _resolve_path(get_value("raw_output", default.raw_output))
        processed_output = _resolve_path(get_value("processed_output", default.processed_output))

        return cls(
            raw_output=raw_output,
            processed_output=processed_output,
            allowed_domains=list(get_value("allowed_domains", list(default.allowed_domains))),
            root_url=get_value("root_url", default.root_url),
            snippet_chars=int(get_value("graph_snippet_chars", default.snippet_chars)),
        )

    @property
    def metadata_path(self) -> Path:
        return self.raw_output / "metadata.tsv"


class GraphBuilder:
    def __init__(self, settings: GraphSettings) -> None:
        self.settings = settings
        self.nodes: Dict[str, Dict] = {}
        self.edges: List[Dict] = []
        self.graph = nx.DiGraph()

    def build(self) -> None:
        records = self._read_metadata()
        if not records:
            logging.error("No metadata records found at %s", self.settings.metadata_path)
            return

        for record in records:
            url = record["url"]
            node = {
                "url": url,
                "path": record["path"],
                "content_type": record["content_type"],
                "doc_type": self._infer_doc_type(record["path"], record["content_type"]),
                "title": None,
                "word_count": 0,
                "clean_text": "",
                "snippet": "",
            }

            if self._is_html(record["content_type"], record["path"]):
                title, word_count, links, clean_text = self._process_html(Path(record["path"]), url)
                node["title"] = title
                node["word_count"] = word_count
                node["clean_text"] = clean_text
                node["snippet"] = clean_text[: self.settings.snippet_chars]
                for link_url, anchor_text in links:
                    if not self._is_allowed_domain(link_url):
                        continue
                    self.edges.append({"source": url, "target": link_url, "anchor_text": anchor_text})
            else:
                node["title"] = Path(record["path"]).name

            self.nodes[url] = node

        self._build_graph()
        self._compute_metrics()
        self._write_outputs()

    def _read_metadata(self) -> List[Dict[str, str]]:
        metadata_path = self.settings.metadata_path
        if not metadata_path.exists():
            logging.error("Metadata file missing: %s", metadata_path)
            return []
        records: List[Dict[str, str]] = []
        with metadata_path.open("r", encoding="utf-8") as meta:
            header = meta.readline()
            for line in meta:
                parts = line.strip().split("\t")
                if len(parts) != 3:
                    continue
                url, path_str, content_type = parts
                records.append({"url": url, "path": path_str, "content_type": content_type})
        return records

    @staticmethod
    def _infer_doc_type(path: str, content_type: str) -> str:
        extension = Path(path).suffix.lower()
        if extension:
            return extension.lstrip(".")
        if content_type:
            return content_type.split("/")[-1]
        return "unknown"

    @staticmethod
    def _is_html(content_type: str, path: str) -> bool:
        if "text/html" in content_type:
            return True
        return Path(path).suffix.lower() in {".html", ".htm", ".php", ".asp", ".aspx", ".jsp"}

    def _process_html(self, path: Path, base_url: str) -> Tuple[str, int, List[Tuple[str, str]], str]:
        try:
            html = path.read_text(encoding="utf-8", errors="ignore")
        except FileNotFoundError:
            logging.warning("HTML file missing during graph build: %s", path)
            return "", 0, [], ""

        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript", "svg"]):
            tag.decompose()

        title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
        text = soup.get_text(separator=" ", strip=True)
        clean_text = " ".join(text.split())
        word_count = len(clean_text.split())

        links: List[Tuple[str, str]] = []
        for anchor in soup.find_all("a", href=True):
            href = anchor["href"].strip()
            absolute = urljoin(base_url, href).split("#", 1)[0].rstrip("/")
            if not absolute:
                continue
            anchor_text = anchor.get_text(strip=True)[:200]
            links.append((absolute, anchor_text))
        return title, word_count, links, clean_text

    def _is_allowed_domain(self, url: str) -> bool:
        parsed = urlparse(url)
        return parsed.netloc in self.settings.allowed_domains

    def _build_graph(self) -> None:
        for url, data in self.nodes.items():
            self.graph.add_node(url, **data)

        for edge in self.edges:
            target = edge["target"]
            if target not in self.nodes:
                self.nodes[target] = {
                    "url": target,
                    "path": "",
                    "content_type": "",
                    "doc_type": "external",
                    "title": None,
                    "word_count": 0,
                    "clean_text": "",
                    "snippet": "",
                }
                self.graph.add_node(target, **self.nodes[target])
            self.graph.add_edge(edge["source"], target, anchor_text=edge["anchor_text"])

    def _compute_metrics(self) -> None:
        if self.graph.number_of_nodes() == 0:
            return

        pagerank = nx.pagerank(self.graph, alpha=0.85, max_iter=200)
        betweenness = nx.betweenness_centrality(self.graph, normalized=True)
        depth = {}
        root = self.settings.root_url.rstrip("/")
        if root in self.graph:
            depth = nx.single_source_shortest_path_length(self.graph, root)

        for url, data in self.nodes.items():
            data["metrics"] = {
                "in_degree": self.graph.in_degree(url),
                "out_degree": self.graph.out_degree(url),
                "pagerank": pagerank.get(url, 0.0),
                "betweenness": betweenness.get(url, 0.0),
                "depth_from_root": depth.get(url),
            }

    def _write_outputs(self) -> None:
        output_dir = self.settings.processed_output
        output_dir.mkdir(parents=True, exist_ok=True)
        nodes_path = output_dir / "nodes.json"
        edges_path = output_dir / "edges.json"
        with nodes_path.open("w", encoding="utf-8") as f:
            json.dump(list(self.nodes.values()), f, indent=2)
        with edges_path.open("w", encoding="utf-8") as f:
            json.dump(self.edges, f, indent=2)
        logging.info("Wrote %s and %s", nodes_path, edges_path)


def _resolve_path(path_value) -> Path:
    path = path_value if isinstance(path_value, Path) else Path(path_value)
    if not path.is_absolute():
        path = REPO_ROOT / path
    return path


def load_settings(config_path: Path | None = None) -> GraphSettings:
    path = config_path or DEFAULT_CONFIG_PATH
    if path.exists():
        try:
            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            logging.info("Loaded pipeline config from %s", path)
            return GraphSettings.from_dict(data)
        except json.JSONDecodeError as exc:
            logging.error("Failed to parse config %s: %s", path, exc)
    else:
        logging.warning("Config file %s not found. Using defaults.", path)
    return GraphSettings()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    config_path = os.environ.get("PIPELINE_CONFIG")
    settings = load_settings(Path(config_path) if config_path else None)
    builder = GraphBuilder(settings)
    builder.build()


if __name__ == "__main__":
    main()
