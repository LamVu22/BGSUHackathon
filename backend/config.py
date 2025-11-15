from __future__ import annotations

import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel, Field


class Settings(BaseModel):
    """Runtime configuration loaded from environment variables."""

    openai_api_key: str | None = Field(default=None, repr=False)
    openai_model: str = "gpt-4o-mini"
    embedding_model: str = "text-embedding-3-small"

    search_provider: str = "bing"  # options: bing, tavily
    bing_api_key: str | None = Field(default=None, repr=False)
    tavily_api_key: str | None = Field(default=None, repr=False)

    max_web_results: int = 10
    top_k_chunks: int = 6
    chunk_chars: int = 1200
    chunk_overlap: int = 200
    min_chunk_chars: int = 280
    request_timeout: float = 15.0

    user_agent: str = "FalconGraphSearchBot/0.1 (+https://www.bgsu.edu)"

    class Config:
        extra = "ignore"


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Load .env + environment variables and return Settings singleton."""

    load_dotenv()
    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        search_provider=os.getenv("SEARCH_PROVIDER", "bing").lower(),
        bing_api_key=os.getenv("BING_API_KEY"),
        tavily_api_key=os.getenv("TAVILY_API_KEY"),
    )
