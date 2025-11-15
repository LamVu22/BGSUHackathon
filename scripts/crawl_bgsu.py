#!/usr/bin/env python3
"""
Site crawler for https://www.bgsu.edu/.

Performs a breadth-first traversal across allowed BGSU domains, saves HTML
pages and linked assets (PDF, documents, etc.) into data/raw/, and logs URL/path
metadata for downstream processing.

Usage (run from repo root with venv activated):

    python scripts/crawl_bgsu.py

Configuration lives in config/pipeline.json (or via PIPELINE_CONFIG env var).
"""

from __future__ import annotations

import logging
import os
import time
import json
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Deque, Iterable, List, Set
from urllib.parse import urljoin, urlparse, urldefrag
from urllib import robotparser

import requests
from bs4 import BeautifulSoup

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG_PATH = REPO_ROOT / "config" / "pipeline.json"


DEFAULT_ALLOWED_EXTENSIONS = {
    ".html",
    ".htm",
    ".php",
    ".asp",
    ".aspx",
    ".jsp",
    ".pdf",
    ".txt",
    ".json",
    ".csv",
    ".xml",
    ".doc",
    ".docx",
    ".ppt",
    ".pptx",
    ".xls",
    ".xlsx",
    ".rtf",
    ".srt",
    ".vtt",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".zip",
    ".tar",
    ".gz",
    ".mp3",
    ".mp4",
}


@dataclass
class CrawlerConfig:
    start_url: str
    output_dir: Path
    allowed_domains: Set[str]
    max_pages: int = -1  # -1 means "no explicit limit"
    request_delay: float = 0.25  # seconds
    timeout: float = 20.0  # seconds
    allowed_extensions: Set[str] = field(default_factory=lambda: DEFAULT_ALLOWED_EXTENSIONS)


class SiteCrawler:
    def __init__(self, config: CrawlerConfig) -> None:
        self.config = config
        self.visited: Set[str] = set()
        self.to_visit: Deque[str] = deque([config.start_url])
        self.session = requests.Session()
        self.robot_parser = robotparser.RobotFileParser()
        self.robot_parser.set_url(urljoin(config.start_url, "/robots.txt"))
        try:
            self.robot_parser.read()
        except Exception as exc:  # pragma: no cover - informational
            logging.warning("Failed to read robots.txt: %s", exc)

        (config.output_dir / "html").mkdir(parents=True, exist_ok=True)
        (config.output_dir / "files").mkdir(parents=True, exist_ok=True)
        self.metadata_file = config.output_dir / "metadata.tsv"
        if not self.metadata_file.exists():
            self.metadata_file.write_text("url\tpath\tcontent_type\n", encoding="utf-8")

    def crawl(self) -> None:
        pages_fetched = 0
        while self.to_visit and (self.config.max_pages < 0 or pages_fetched < self.config.max_pages):
            url = self.to_visit.popleft()
            url = self._normalize_url(url)
            if not url or url in self.visited:
                continue
            if not self._is_allowed(url):
                continue

            try:
                logging.info("Fetching %s", url)
                response = self.session.get(url, timeout=self.config.timeout)
            except requests.RequestException as exc:
                logging.warning("Failed to fetch %s: %s", url, exc)
                continue

            self.visited.add(url)
            pages_fetched += 1

            content_type = response.headers.get("Content-Type", "").split(";")[0].strip()
            if "text/html" in content_type:
                self._handle_html(url, response.text, content_type)
            else:
                self._handle_binary(url, response.content, content_type)

            time.sleep(self.config.request_delay)

    def _handle_html(self, url: str, html: str, content_type: str) -> None:
        output_path = self._write_html(url, html)
        self._log_metadata(url, output_path, content_type)

        soup = BeautifulSoup(html, "html.parser")
        for anchor in soup.find_all("a", href=True):
            href = urljoin(url, anchor["href"])
            href = self._normalize_url(href)
            if not href:
                continue
            if self._should_enqueue(href) or self._should_download_asset(href):
                self.to_visit.append(href)

    def _handle_binary(self, url: str, content: bytes, content_type: str) -> None:
        extension = Path(urlparse(url).path).suffix or ".bin"
        safe_name = self._safe_filename(url, extension, prefix="files")
        file_path = self.config.output_dir / "files" / safe_name
        file_path.write_bytes(content)
        self._log_metadata(url, file_path, content_type)

    def _write_html(self, url: str, html: str) -> Path:
        safe_name = self._safe_filename(url, ".html", prefix="html")
        file_path = self.config.output_dir / "html" / safe_name
        file_path.write_text(html, encoding="utf-8", errors="ignore")
        return file_path

    def _log_metadata(self, url: str, file_path: Path, content_type: str) -> None:
        with self.metadata_file.open("a", encoding="utf-8") as meta:
            meta.write(f"{url}\t{file_path}\t{content_type}\n")

    def _is_allowed(self, url: str) -> bool:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"}:
            return False
        if parsed.netloc not in self.config.allowed_domains:
            return False
        if not self.robot_parser.can_fetch("*", url):
            logging.debug("Blocked by robots.txt: %s", url)
            return False

        if not self._extension_allowed(parsed.path, parsed.query):
            return False
        return True

    def _should_enqueue(self, url: str) -> bool:
        if url in self.visited:
            return False
        parsed = urlparse(url)
        if parsed.netloc not in self.config.allowed_domains:
            return False
        if parsed.scheme not in {"http", "https"}:
            return False
        return True

    def _should_download_asset(self, url: str) -> bool:
        parsed = urlparse(url)
        if parsed.netloc not in self.config.allowed_domains:
            return False
        return self._extension_allowed(parsed.path, parsed.query)

    @staticmethod
    def _normalize_url(url: str) -> str:
        if not url:
            return ""
        url, _fragment = urldefrag(url)
        parsed = urlparse(url)
        if not parsed.scheme:
            url = f"https://{url.lstrip('/')}"
        return url.rstrip("/")

    def _extension_allowed(self, path: str, query: str) -> bool:
        extension = Path(path).suffix.lower()
        if extension in self.config.allowed_extensions:
            return True
        if not extension and any(marker in query.lower() for marker in ("format=pdf", "format=doc", "download=1")):
            return True
        return not extension  # allow extension-less HTML pages

    @staticmethod
    def _safe_filename(url: str, extension: str, prefix: str) -> str:
        parsed = urlparse(url)
        path = parsed.path.strip("/")
        if not path:
            path = "index"
        safe_path = path.replace("/", "_")
        query = parsed.query.replace("=", "_").replace("&", "_")
        if query:
            safe_path = f"{safe_path}_{query}"
        safe_path = safe_path[:200]  # avoid overly long filenames
        if not safe_path.endswith(extension):
            safe_path = f"{safe_path}{extension}"
        return f"{prefix}__{parsed.netloc}_{safe_path}"


@dataclass
class CrawlerSettings:
    start_url: str = "https://www.bgsu.edu"
    allowed_domains: List[str] = field(default_factory=lambda: ["www.bgsu.edu", "bgsu.edu"])
    raw_output: Path = REPO_ROOT / "data/raw"
    max_pages: int = -1
    delay: float = 0.25
    timeout: float = 20.0
    extensions: Set[str] = field(default_factory=lambda: set(DEFAULT_ALLOWED_EXTENSIONS))

    @classmethod
    def from_dict(cls, data: dict[str, object]) -> "CrawlerSettings":
        default = cls()

        def get_value(key: str, fallback):
            return data.get(key, fallback) if isinstance(data, dict) else fallback

        raw_output = _resolve_path(get_value("raw_output", default.raw_output))
        extensions = get_value("extensions", list(default.extensions))
        if isinstance(extensions, (list, set, tuple)):
            extensions_set = {ext if ext.startswith(".") else f".{ext}" for ext in extensions}
        else:
            extensions_set = set(default.extensions)

        return cls(
            start_url=get_value("start_url", default.start_url),
            allowed_domains=list(get_value("allowed_domains", list(default.allowed_domains))),
            raw_output=raw_output,
            max_pages=int(get_value("max_pages", default.max_pages)),
            delay=float(get_value("delay", default.delay)),
            timeout=float(get_value("timeout", default.timeout)),
            extensions=extensions_set,
        )


def run_crawler(settings: CrawlerSettings) -> None:
    logging.info("Starting crawl from %s", settings.start_url)
    crawler_config = CrawlerConfig(
        start_url=settings.start_url,
        output_dir=settings.raw_output,
        allowed_domains=set(settings.allowed_domains),
        max_pages=settings.max_pages,
        request_delay=settings.delay,
        timeout=settings.timeout,
        allowed_extensions=settings.extensions,
    )
    SiteCrawler(crawler_config).crawl()


def _resolve_path(path_value) -> Path:
    path = path_value if isinstance(path_value, Path) else Path(path_value)
    if not path.is_absolute():
        path = REPO_ROOT / path
    return path


def load_settings(config_path: Path | None = None) -> CrawlerSettings:
    path = config_path or DEFAULT_CONFIG_PATH
    if path.exists():
        try:
            with path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            logging.info("Loaded pipeline config from %s", path)
            return CrawlerSettings.from_dict(data)
        except json.JSONDecodeError as exc:
            logging.error("Failed to parse config %s: %s", path, exc)
    else:
        logging.warning("Config file %s not found. Using defaults.", path)
    return CrawlerSettings()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    config_path = os.environ.get("PIPELINE_CONFIG")
    settings = load_settings(Path(config_path) if config_path else None)
    run_crawler(settings)


if __name__ == "__main__":
    main()
