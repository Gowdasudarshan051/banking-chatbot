"""
Chat routes — the core Q&A interface.
All authenticated roles can query.
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.security import require_any_role
from app.core.vector_db import VectorDBManager
from app.services.ollama_service import generate_answer, stream_answer
from app.models.user import UserInDB
from app.core.config import settings

router = APIRouter()


class ChatRequest(BaseModel):
    question: str
    stream: bool = False
    top_k: int = settings.TOP_K


class ChatResponse(BaseModel):
    answer: str
    sources: list[dict]
    question: str


@router.post("/query", response_model=ChatResponse)
async def query(
    req: ChatRequest,
    current_user: UserInDB = Depends(require_any_role),
):
    """Retrieve relevant chunks, build context, call LLM, return answer."""
    if not req.question.strip():
        raise HTTPException(400, "Question cannot be empty")

    # 1. Search FAISS
    chunks = await VectorDBManager.search(req.question, top_k=req.top_k)

    if not chunks:
        return ChatResponse(
            question=req.question,
            answer=(
                "I could not find relevant information in the document library. "
                "Please ensure the relevant documents have been uploaded and processed."
            ),
            sources=[],
        )

    # 2. Call LLM
    try:
        answer = await generate_answer(req.question, chunks)
    except RuntimeError as e:
        raise HTTPException(503, str(e))

    # 3. Build source list (deduplicated by doc/chunk)
    sources = [
        {"filename": c["filename"], "chunk_idx": c["chunk_idx"], "score": round(c["score"], 4)}
        for c in chunks
    ]

    return ChatResponse(question=req.question, answer=answer, sources=sources)


@router.post("/stream")
async def query_stream(
    req: ChatRequest,
    current_user: UserInDB = Depends(require_any_role),
):
    """Streaming SSE endpoint — returns tokens as they are generated."""
    if not req.question.strip():
        raise HTTPException(400, "Question cannot be empty")

    chunks = await VectorDBManager.search(req.question, top_k=req.top_k)

    if not chunks:
        async def _empty():
            yield "data: No relevant documents found.\n\n"
        return StreamingResponse(_empty(), media_type="text/event-stream")

    async def _token_stream():
        try:
            async for token in stream_answer(req.question, chunks):
                yield f"data: {token}\n\n"
        except RuntimeError as e:
            yield f"data: ERROR: {e}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(_token_stream(), media_type="text/event-stream")
