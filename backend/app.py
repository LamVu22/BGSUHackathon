from __future__ import annotations

import logging
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .config import get_settings
from .rag import RAGPipeline


logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

settings = get_settings()
pipeline = RAGPipeline(settings)

app = FastAPI(title="FalconGraph Web RAG API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class SearchRequest(BaseModel):
    question: str = Field(..., min_length=3)
    max_results: Optional[int] = Field(None, ge=1, le=20)


@app.get("/healthz")
async def healthcheck():
    return {
        "status": "ok",
        "openai": bool(settings.openai_api_key),
        "provider": settings.search_provider,
        "max_results": settings.max_web_results,
    }


@app.post("/search")
async def search(payload: SearchRequest):
    if not settings.openai_api_key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is not configured.")
    try:
        response = await pipeline.run(payload.question, payload.max_results)
        return response
    except Exception as exc:  # pragma: no cover - runtime safety
        logger.exception("Search failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc)) from exc
