#!/usr/bin/env python3
"""
Lightweight link discovery scanner for https://www.bgsu.edu/.

Performs a breadth-first traversal (without saving files) to count unique URLs
and capture a link map. Useful for estimating crawl size before running the full
downloader.

Usage (run from repo root with venv activated):

    python scripts/link_map.py

Configuration lives in config/pipeline.json (or override via PIPELINE_CONFIG).
"""

from __future__ import annotations

import json
import logging
import os
import time
from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Deque, Dict, List, Set, Tuple
from urllib.parse import urljoin, urlparse, urldefrag

import requests
from bs4 import BeautifulSoup

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = REPO_ROOT / "config" / "pipeline.json"


@dataclass
class LinkMapSettings:
    start_url: str = "https://www.bgsu.edu"
    allowed_domains: List[str] = None  # type: ignore
    max_pages: int = -1
    delay: float = 0.2
    timeout: float = 15.0
    output_path: Path = REPO_ROOT / "data/link_map.json"

    def __post_init__(self) -> None:
        if self.allowed_domains is None:
            self.allowed_domains = ["www.bgsu.edu", "bgsu.edu"]

    @classmethod
    def from_dict(cls, data: Dict[str, object]) -> "LinkMapSettings":
        default = cls()

        def get_value(key: str, fallback):
            return data.get(key, fallback) if isinstance(data, dict) else fallback

        output_path = _resolve_path(get_value("link_map_output", default.output_path))

        max_pages = get_value("link_map_max_pages", default.max_pages)

        return cls(
            start_url=get_value("start_url", default.start_url),
            allowed_domains=list(get_value("allowed_domains", list(default.allowed_domains))),
            max_pages=int(max_pages),
            delay=float(get_value("delay", default.delay)),
            timeout=float(get_value("timeout", default.timeout)),
            output_path=output_path,
        )


class LinkScanner:
    def __init__(self, settings: LinkMapSettings) -> None:
        self.settings = settings
        self.visited: Set[str] = set()
        self.edges: Set[Tuple[str, str]] = set()
        self.queue: Deque[str] = deque([settings.start_url])
        self.session = requests.Session()

    def run(self) -> Dict[str, object]:
        pages_processed = 0
        while self.queue and (self.settings.max_pages < 0 or pages_processed < self.settings.max_pages):
            url = self.queue.popleft()
            url = self._normalize_url(url)
            if not url or url in self.visited:
                continue
            if not self._is_allowed(url):
                continue

            try:
                logging.info("Scanning %s", url)
                response = self.session.get(url, timeout=self.settings.timeout)
            except requests.RequestException as exc:
                logging.warning("Failed to fetch %s: %s", url, exc)
                continue

            self.visited.add(url)
            pages_processed += 1

            content_type = response.headers.get("Content-Type", "").split(";")[0].strip()
            if "text/html" not in content_type:
                continue

            soup = BeautifulSoup(response.text, "html.parser")
            for anchor in soup.find_all("a", href=True):
                href = anchor["href"]
                absolute = self._normalize_url(urljoin(url, href))
                if not absolute:
                    continue
                if self._is_allowed(absolute):
                    self.edges.add((url, absolute))
                    if absolute not in self.visited:
                        self.queue.append(absolute)

            time.sleep(self.settings.delay)

        return {
            "stats": {
                "pages_processed": pages_processed,
                "unique_urls": len(self.visited),
                "unique_edges": len(self.edges),
            },
            "nodes": sorted(self.visited),
            "edges": [{"source": src, "target": dst} for src, dst in sorted(self.edges)],
        }

    def _is_allowed(self, url: str) -> bool:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            return False
        return parsed.netloc in self.settings.allowed_domains

    @staticmethod
    def _normalize_url(url: str) -> str:
        if not url:
            return ""
        url, _fragment = urldefrag(url)
        parsed = urlparse(url)
        if not parsed.scheme:
            url = f"https://{url.lstrip('/')}"
        return url.rstrip("/")


def _resolve_path(path_value) -> Path:
    path = path_value if isinstance(path_value, Path) else Path(path_value)
    if not path.is_absolute():
        path = REPO_ROOT / path
    return path


def load_settings(config_path: Path | None = None) -> LinkMapSettings:
    path = config_path or DEFAULT_CONFIG_PATH
    if path.exists():
        try:
            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            logging.info("Loaded pipeline config from %s", path)
            return LinkMapSettings.from_dict(data)
        except json.JSONDecodeError as exc:
            logging.error("Failed to parse config %s: %s", path, exc)
    else:
        logging.warning("Config file %s not found. Using defaults.", path)
    return LinkMapSettings()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    config_path = os.environ.get("PIPELINE_CONFIG")
    settings = load_settings(Path(config_path) if config_path else None)

    output = LinkScanner(settings).run()
    settings.output_path.parent.mkdir(parents=True, exist_ok=True)
    with settings.output_path.open("w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    logging.info(
        "Link map written to %s (pages=%d, unique_urls=%d)",
        settings.output_path,
        output["stats"]["pages_processed"],
        output["stats"]["unique_urls"],
    )


if __name__ == "__main__":
    main()
