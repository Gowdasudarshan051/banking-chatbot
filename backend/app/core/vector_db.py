"""
FAISS vector database — singleton manager.
Handles index creation, persistence, and similarity search.
"""
from __future__ import annotations
import asyncio
import json
import logging
import pickle
from pathlib import Path
from typing import List, Tuple

import numpy as np
import faiss
from sentence_transformers import SentenceTransformer

from app.core.config import settings

logger = logging.getLogger(__name__)

INDEX_FILE   = settings.FAISS_INDEX_PATH / "index.faiss"
META_FILE    = settings.FAISS_INDEX_PATH / "metadata.pkl"


class VectorDBManager:
    """Thread-safe FAISS index manager with GPU support."""

    _index: faiss.Index | None = None
    _metadata: list[dict] = []          # parallel list of chunk metadata
    _model: SentenceTransformer | None  = None
    _dim: int = 384                     # all-MiniLM-L6-v2 dimension

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    @classmethod
    async def initialise(cls) -> None:
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(None, cls._init_sync)

    @classmethod
    def _init_sync(cls) -> None:
        device = "cuda" if settings.USE_GPU else "cpu"
        logger.info("Loading embedding model on %s …", device)
        cls._model = SentenceTransformer(settings.EMBEDDING_MODEL, device=device)
        cls._dim = cls._model.get_sentence_embedding_dimension()

        if INDEX_FILE.exists() and META_FILE.exists():
            cls._index = faiss.read_index(str(INDEX_FILE))
            with open(META_FILE, "rb") as f:
                cls._metadata = pickle.load(f)
            logger.info("Loaded existing FAISS index — %d vectors.", cls._index.ntotal)
        else:
            cls._index = faiss.IndexFlatIP(cls._dim)   # inner-product (cosine on unit vecs)
            cls._metadata = []
            logger.info("Created new FAISS index (dim=%d).", cls._dim)

    # ── Embedding ─────────────────────────────────────────────────────────────

    @classmethod
    def embed(cls, texts: list[str]) -> np.ndarray:
        """Return L2-normalised embeddings (shape: N × dim)."""
        vecs = cls._model.encode(texts, convert_to_numpy=True, batch_size=32, show_progress_bar=False)
        faiss.normalize_L2(vecs)
        return vecs.astype(np.float32)

    # ── Add ───────────────────────────────────────────────────────────────────

    @classmethod
    async def add_chunks(cls, chunks: list[str], metadata: list[dict]) -> int:
        """Embed chunks and store in the index. Returns number of vectors added."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls._add_sync, chunks, metadata)

    @classmethod
    def _add_sync(cls, chunks: list[str], metadata: list[dict]) -> int:
        vecs = cls.embed(chunks)
        cls._index.add(vecs)
        cls._metadata.extend(metadata)
        cls._persist()
        return len(chunks)

    # ── Search ────────────────────────────────────────────────────────────────

    @classmethod
    async def search(cls, query: str, top_k: int = settings.TOP_K) -> list[dict]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls._search_sync, query, top_k)

    @classmethod
    def _search_sync(cls, query: str, top_k: int) -> list[dict]:
        if cls._index.ntotal == 0:
            return []
        q_vec = cls.embed([query])
        scores, indices = cls._index.search(q_vec, min(top_k, cls._index.ntotal))
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx == -1:
                continue
            entry = dict(cls._metadata[idx])
            entry["score"] = float(score)
            results.append(entry)
        return results

    # ── Delete by document ────────────────────────────────────────────────────

    @classmethod
    async def delete_document(cls, doc_id: str) -> int:
        """Remove all vectors belonging to a document. Returns removed count."""
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, cls._delete_sync, doc_id)

    @classmethod
    def _delete_sync(cls, doc_id: str) -> int:
        keep_indices = [i for i, m in enumerate(cls._metadata) if m.get("doc_id") != doc_id]
        removed = len(cls._metadata) - len(keep_indices)
        if removed == 0:
            return 0

        # Rebuild index from surviving vectors
        all_vecs = faiss.rev_swig_ptr(
            cls._index.get_xb(), cls._index.ntotal * cls._dim
        ).reshape(cls._index.ntotal, cls._dim)

        new_vecs = np.array([all_vecs[i] for i in keep_indices], dtype=np.float32)
        cls._metadata = [cls._metadata[i] for i in keep_indices]
        cls._index = faiss.IndexFlatIP(cls._dim)
        if len(new_vecs):
            cls._index.add(new_vecs)
        cls._persist()
        return removed

    # ── Persist ───────────────────────────────────────────────────────────────

    @classmethod
    def _persist(cls) -> None:
        faiss.write_index(cls._index, str(INDEX_FILE))
        with open(META_FILE, "wb") as f:
            pickle.dump(cls._metadata, f)

    # ── Stats ─────────────────────────────────────────────────────────────────

    @classmethod
    def stats(cls) -> dict:
        return {
            "total_vectors": cls._index.ntotal if cls._index else 0,
            "dimension": cls._dim,
            "unique_documents": len({m["doc_id"] for m in cls._metadata}),
        }
