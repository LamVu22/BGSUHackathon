from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
import re
import time
from typing import Any, Dict, List, Sequence
from urllib.parse import urlparse

import faiss
import httpx
import numpy as np
from bs4 import BeautifulSoup
from openai import AsyncOpenAI

from .config import Settings


logger = logging.getLogger(__name__)


@dataclass
class WebResult:
    url: str
    title: str
    snippet: str


@dataclass
class DocumentChunk:
    id: int
    url: str
    title: str
    text: str
    score: float = 0.0

    @property
    def domain(self) -> str:
        return urlparse(self.url).netloc


class WebSearchClient:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def search(self, query: str, limit: int | None = None) -> List[WebResult]:
        limit = limit or self.settings.max_web_results
        provider = self.settings.search_provider
        if provider == "bing":
            return await self._search_bing(query, limit)
        if provider == "tavily":
            return await self._search_tavily(query, limit)
        raise ValueError(f"Unsupported SEARCH_PROVIDER: {provider}")

    async def _search_bing(self, query: str, limit: int) -> List[WebResult]:
        if not self.settings.bing_api_key:
            raise RuntimeError("BING_API_KEY is not configured.")
        url = "https://api.bing.microsoft.com/v7.0/search"
        params = {"q": query, "count": limit}
        headers = {"Ocp-Apim-Subscription-Key": self.settings.bing_api_key}
        async with httpx.AsyncClient(timeout=self.settings.request_timeout) as client:
            resp = await client.get(url, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        values = data.get("webPages", {}).get("value", [])
        results = []
        for entry in values[:limit]:
            results.append(
                WebResult(
                    url=entry.get("url", ""),
                    title=entry.get("name", "Untitled"),
                    snippet=entry.get("snippet", ""),
                )
            )
        return results

    async def _search_tavily(self, query: str, limit: int) -> List[WebResult]:
        if not self.settings.tavily_api_key:
            raise RuntimeError("TAVILY_API_KEY is not configured.")
        url = "https://api.tavily.com/search"
        payload = {
            "api_key": self.settings.tavily_api_key,
            "query": query,
            "max_results": limit,
            "include_images": False,
            "include_answer": False,
        }
        headers = {"Content-Type": "application/json"}
        async with httpx.AsyncClient(timeout=self.settings.request_timeout) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()
        results = []
        for entry in data.get("results", [])[:limit]:
            results.append(
                WebResult(
                    url=entry.get("url", ""),
                    title=entry.get("title", "Untitled"),
                    snippet=entry.get("content", entry.get("snippet", "")),
                )
            )
        return results


class WebScraper:
    def __init__(self, settings: Settings):
        self.settings = settings

    async def fetch_bulk(self, results: Sequence[WebResult]) -> List[Dict[str, str]]:
        async with httpx.AsyncClient(
            timeout=self.settings.request_timeout,
            headers={"User-Agent": self.settings.user_agent},
            follow_redirects=True,
        ) as client:
            tasks = [self._fetch_single(client, result) for result in results]
            pages = await asyncio.gather(*tasks, return_exceptions=True)
        documents: List[Dict[str, str]] = []
        for page in pages:
            if isinstance(page, Exception):
                logger.debug("Skipping page due to error: %s", page)
                continue
            if page.get("text"):
                documents.append(page)
        return documents

    async def _fetch_single(self, client: httpx.AsyncClient, result: WebResult) -> Dict[str, str]:
        if not result.url:
            return {"url": "", "title": result.title, "text": ""}
        try:
            resp = await client.get(result.url)
            resp.raise_for_status()
        except Exception as exc:
            logger.debug("Failed to fetch %s: %s", result.url, exc)
            return {"url": result.url, "title": result.title, "text": ""}
        text = self._extract_text(resp.text)
        trimmed = text[: 12000]  # keep payload manageable per page
        return {"url": str(resp.url), "title": result.title or self._fallback_title(resp.text), "text": trimmed}

    @staticmethod
    def _extract_text(html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        for tag in soup(["script", "style", "noscript", "svg"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        return " ".join(text.split())

    @staticmethod
    def _fallback_title(html: str) -> str:
        soup = BeautifulSoup(html, "html.parser")
        if soup.title and soup.title.string:
            return soup.title.string.strip()
        return "Untitled page"


def chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    cleaned = text.strip()
    if not cleaned:
        return []
    overlap = min(overlap, chunk_size - 1) if chunk_size > 1 else 0
    chunks = []
    start = 0
    while start < len(cleaned):
        end = min(len(cleaned), start + chunk_size)
        chunk = cleaned[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end == len(cleaned):
            break
        start = end - overlap
    return chunks


class RAGPipeline:
    def __init__(self, settings: Settings):
        self.settings = settings
        self.search_client = WebSearchClient(settings)
        self.scraper = WebScraper(settings)
        if not self.settings.openai_api_key:
            logger.warning("OPENAI_API_KEY is not configured. RAG responses will fail until set.")
        self.openai = AsyncOpenAI(api_key=self.settings.openai_api_key) if self.settings.openai_api_key else None

    async def run(self, question: str, limit: int | None = None) -> Dict[str, Any]:
        start_time = time.perf_counter()
        limit = limit or self.settings.max_web_results
        search_results = await self.search_client.search(question, limit)
        pages = await self.scraper.fetch_bulk(search_results)
        chunks = self._build_chunks(pages)
        if not chunks:
            return {
                "answer": "I could not retrieve enough information to answer that question.",
                "citations": [],
                "chunks": [],
                "search_results": [result.__dict__ for result in search_results],
                "stats": {
                    "sources": len(pages),
                    "chunks": 0,
                    "latency": round(time.perf_counter() - start_time, 2),
                    "web_hits": len(search_results),
                },
            }
        scores, ranked_chunks = await self._rank_chunks(question, chunks)
        response_text = await self._summarize(question, ranked_chunks)
        citations = [
            {
                "id": chunk.id,
                "title": chunk.title,
                "url": chunk.url,
                "snippet": chunk.text[:280],
                "domain": chunk.domain,
                "score": round(score, 3),
                "type": "web",
            }
            for chunk, score in zip(ranked_chunks, scores)
        ]
        return {
            "answer": response_text,
            "citations": citations,
            "chunks": [chunk.__dict__ for chunk in ranked_chunks],
            "search_results": [result.__dict__ for result in search_results],
            "stats": {
                "sources": len(pages),
                "chunks": len(ranked_chunks),
                "latency": round(time.perf_counter() - start_time, 2),
                "web_hits": len(search_results),
            },
        }

    def _build_chunks(self, documents: Sequence[Dict[str, str]]) -> List[DocumentChunk]:
        chunks: List[DocumentChunk] = []
        chunk_id = 1
        for doc in documents:
            text_chunks = chunk_text(doc["text"], self.settings.chunk_chars, self.settings.chunk_overlap)
            for chunk in text_chunks:
                if len(chunk) < self.settings.min_chunk_chars:
                    continue
                chunks.append(
                    DocumentChunk(
                        id=chunk_id,
                        url=doc["url"],
                        title=doc["title"],
                        text=chunk,
                    )
                )
                chunk_id += 1
        return chunks

    async def _rank_chunks(self, question: str, chunks: List[DocumentChunk]) -> tuple[List[float], List[DocumentChunk]]:
        if not self.openai:
            raise RuntimeError("OPENAI_API_KEY not configured.")
        texts = [chunk.text for chunk in chunks]
        vectors = await self._embed(texts)
        index, matrix = self._build_index(vectors)
        question_vec = await self._embed([question])
        query = np.array(question_vec, dtype="float32")
        faiss.normalize_L2(query)
        scores, indices = index.search(query, min(self.settings.top_k_chunks, len(chunks)))
        flat_scores = scores.flatten().tolist()
        ranked = [chunks[i] for i in indices.flatten()]
        normalized_scores = [self._normalize_score(score) for score in flat_scores]
        for chunk, score in zip(ranked, normalized_scores):
            chunk.score = score
        return normalized_scores, ranked

    async def _embed(self, texts: Sequence[str]) -> List[List[float]]:
        assert self.openai, "OPENAI_API_KEY not configured."
        vectors: List[List[float]] = []
        batch_size = 16
        for start in range(0, len(texts), batch_size):
            batch = texts[start : start + batch_size]
            resp = await self.openai.embeddings.create(model=self.settings.embedding_model, input=batch)
            vectors.extend([item.embedding for item in resp.data])
        return vectors

    @staticmethod
    def _build_index(vectors: Sequence[Sequence[float]]):
        matrix = np.array(vectors, dtype="float32")
        faiss.normalize_L2(matrix)
        index = faiss.IndexFlatIP(matrix.shape[1])
        index.add(matrix)
        return index, matrix

    async def _summarize(self, question: str, chunks: Sequence[DocumentChunk]) -> str:
        if not self.openai:
            raise RuntimeError("OPENAI_API_KEY not configured.")
        if not chunks:
            return "I could not find sufficient supporting evidence to answer that question."

        context_blocks = []
        for idx, chunk in enumerate(chunks, start=1):
            context_blocks.append(f"[{idx}] {chunk.title} ({chunk.url})\n{chunk.text[:900]}")
        context_text = "\n\n".join(context_blocks)

        prompt = (
            "You are FalconGraph Search. Use the numbered context snippets to answer clearly in regular sentences or Markdown lists. "
            "Avoid inserting spaces between letters or words, and do not repeat content verbatim from the snippets. "
            "Cite supporting snippets inline using [number] notation. If the answer cannot be derived, explicitly say so."
        )
        user_content = f"Question: {question}\n\nContext:\n{context_text}"
        response = await self.openai.responses.create(
            model=self.settings.openai_model,
            input=[
                {"role": "system", "content": [{"type": "input_text", "text": prompt}]},
                {"role": "user", "content": [{"type": "input_text", "text": user_content}]},
            ],
            max_output_tokens=500,
            temperature=0.2,
        )
        logger.info("LLM raw output: %s", getattr(response, "output_text", []))
        parts: List[str] = []
        if response.output:
            for item in response.output:
                for chunk in item.content:
                    if chunk.type == "output_text":
                        parts.append(chunk.text)
        text = "\n".join(parts).strip()
        return self._cleanup_answer(text or "No answer was generated.")

    @staticmethod
    def _normalize_score(score: float) -> float:
        return max(0.0, min(1.0, (score + 1.0) / 2.0))

    @staticmethod
    def _cleanup_answer(text: str) -> str:
        if not text:
            return text
        # merge spaced-out single letters without touching normal words (e.g., "B G S U" -> "BGSU")
        text = re.sub(r"\b([A-Za-z])\s+([A-Za-z])\b", r"\1\2", text)
        # remove spaces before apostrophes
        text = re.sub(r"\s+'", "'", text)
        # collapse multiple spaces and limit blank lines
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()
