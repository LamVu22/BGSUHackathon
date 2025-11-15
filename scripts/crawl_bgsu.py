#!/usr/bin/env python3
"""
Simple site crawler tailored for https://www.bgsu.edu/.

The crawler performs a breadth-first traversal starting from the supplied URL,
stores HTML pages, and downloads linked assets such as PDFs. It is intentionally
minimal so it can run during a hackathon without extra infrastructure.

Usage (run from repo root, with the venv activated):

    python scripts/crawl_bgsu.py \
        --start-url https://www.bgsu.edu \
        --output-dir data/raw \
        --max-pages 500

The script respects robots.txt directives published by the origin server.
"""

from __future__ import annotations

import argparse
import logging
import os
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path
from typing import Deque, Iterable, Set
from urllib.parse import urljoin, urlparse, urldefrag
from urllib import robotparser

import requests
from bs4 import BeautifulSoup

REPO_ROOT = Path(__file__).resolve().parents[1]


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
    max_pages: int = 500
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
        while self.to_visit and pages_fetched < self.config.max_pages:
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawl BGSU site and download pages/assets.")
    parser.add_argument("--start-url", default="https://www.bgsu.edu", help="Seed URL to begin crawl")
    parser.add_argument(
        "--output-dir",
        default=REPO_ROOT / "data/raw",
        type=Path,
        help="Directory to store downloaded HTML/files and metadata",
    )
    parser.add_argument("--max-pages", type=int, default=500, help="Maximum number of pages to fetch")
    parser.add_argument(
        "--domains",
        nargs="*",
        default=["www.bgsu.edu", "bgsu.edu"],
        help="Additional allowed domains for the crawl",
    )
    parser.add_argument("--delay", type=float, default=0.25, help="Delay between requests in seconds")
    parser.add_argument("--timeout", type=float, default=20.0, help="Request timeout in seconds")
    parser.add_argument(
        "--extensions",
        nargs="*",
        default=sorted(DEFAULT_ALLOWED_EXTENSIONS),
        help="Allowed file extensions to download",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
    config = CrawlerConfig(
        start_url=args.start_url,
        output_dir=args.output_dir,
        allowed_domains=set(args.domains),
        max_pages=args.max_pages,
        request_delay=args.delay,
        timeout=args.timeout,
        allowed_extensions={ext.lower() if ext.startswith(".") else f".{ext.lower()}" for ext in args.extensions},
    )
    crawler = SiteCrawler(config)
    crawler.crawl()


if __name__ == "__main__":
    main()
