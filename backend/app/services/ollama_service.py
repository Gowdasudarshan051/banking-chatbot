"""
Ollama LLM Service
──────────────────
Calls the local Mistral model via Ollama REST API.
Supports streaming and non-streaming responses.
"""
from __future__ import annotations
import logging
from typing import AsyncIterator

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

GENERATE_URL = f"{settings.OLLAMA_BASE_URL}/api/generate"

SYSTEM_PROMPT = """You are a professional banking assistant.

Answer questions based on the provided document context.
Format your response naturally with:
- Proper headings
- Numbered lists each on a new line
- Bullet points each on a new line
- Clear spacing between sections

If the context does not contain enough information, say so clearly.
Do NOT fabricate information."""


def build_prompt(question: str, context_chunks: list[dict]) -> str:
    # Clean context — no chunk labels exposed to model
    context_text = "\n\n".join(
        f"{c['text']}"
        for c in context_chunks
    )
    return f"""{SYSTEM_PROMPT}

=== CONTEXT ===
{context_text}
===============

Question: {question}

Answer:"""


async def generate_answer(question: str, context_chunks: list[dict]) -> str:
    """Non-streaming answer generation."""
    prompt = build_prompt(question, context_chunks)
    payload = {
        "model":  settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "top_p":       0.9,
            "num_predict": 1024,
        },
    }
    async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT) as client:
        try:
            resp = await client.post(GENERATE_URL, json=payload)
            resp.raise_for_status()
            answer = resp.json().get("response", "").strip()
            logger.info("Raw answer preview: %s", answer[:200])
            return answer
        except httpx.ConnectError:
            logger.error("Cannot connect to Ollama at %s", GENERATE_URL)
            raise RuntimeError(
                "LLM service unavailable. Please ensure Ollama is running "
                f"(`ollama serve`) and the {settings.OLLAMA_MODEL} model is pulled."
            )
        except httpx.HTTPStatusError as e:
            logger.error("Ollama HTTP error: %s", e)
            raise RuntimeError(f"LLM service error: {e.response.text}")


async def stream_answer(question: str, context_chunks: list[dict]) -> AsyncIterator[str]:
    """Streaming token-by-token answer generation."""
    import json
    prompt = build_prompt(question, context_chunks)
    payload = {
        "model":  settings.OLLAMA_MODEL,
        "prompt": prompt,
        "stream": True,
        "options": {"temperature": 0.2, "top_p": 0.9, "num_predict": 1024},
    }
    async with httpx.AsyncClient(timeout=settings.OLLAMA_TIMEOUT) as client:
        async with client.stream("POST", GENERATE_URL, json=payload) as resp:
            resp.raise_for_status()
            async for line in resp.aiter_lines():
                if line:
                    data = json.loads(line)
                    token = data.get("response", "")
                    if token:
                        yield token
                    if data.get("done"):
                        break
