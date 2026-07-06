"""
Document management routes.
- Upload    → Admin only
- List      → All roles
- Delete    → Admin only
- Process   → Admin, TeamLead
"""
import asyncio
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, BackgroundTasks

from app.core.config import settings
from app.core.security import require_admin, require_teamlead, require_any_role
from app.models.document import DocumentRecord, DocumentSource, DocumentStatus, DocumentList
from app.models.user import UserInDB
from app.services.document_processor import process_document
from app.services.document_store import document_store
from app.core.vector_db import VectorDBManager

router = APIRouter()

ALLOWED_MIME = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "image/png", "image/jpeg", "image/tiff", "image/bmp",
}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB


@router.post("/upload", status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: UserInDB = Depends(require_admin),
):
    """Upload a document and start async processing."""
    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Unsupported file type: {file.content_type}")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large (max 50 MB)")

    suffix = Path(file.filename).suffix.lower()
    doc_id = str(uuid.uuid4())
    dest = settings.UPLOAD_DIR / f"{doc_id}{suffix}"
    dest.write_bytes(contents)

    record = DocumentRecord(
        id=doc_id,
        filename=dest.name,
        original_name=file.filename,
        file_type=suffix,
        source=DocumentSource.UPLOAD,
        uploaded_by=current_user.username,
        size_bytes=len(contents),
    )
    document_store.add(record)

    background_tasks.add_task(_process_bg, record, dest)
    return {"doc_id": doc_id, "status": "processing"}


async def _process_bg(record: DocumentRecord, path: Path):
    updated = await process_document(record, path)
    document_store.update(updated)


@router.get("/", response_model=DocumentList)
async def list_documents(current_user: UserInDB = Depends(require_any_role)):
    docs = document_store.all()
    return DocumentList(documents=docs, total=len(docs))


@router.get("/{doc_id}")
async def get_document(doc_id: str, current_user: UserInDB = Depends(require_any_role)):
    doc = document_store.get(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")
    return doc


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    doc_id: str,
    current_user: UserInDB = Depends(require_admin),
):
    doc = document_store.get(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    # Remove from FAISS
    await VectorDBManager.delete_document(doc_id)

    # Remove file
    file_path = settings.UPLOAD_DIR / doc.filename
    if file_path.exists():
        file_path.unlink()

    document_store.delete(doc_id)
    return None


@router.post("/{doc_id}/reprocess", status_code=202)
async def reprocess_document(
    doc_id: str,
    background_tasks: BackgroundTasks,
    current_user: UserInDB = Depends(require_teamlead),
):
    doc = document_store.get(doc_id)
    if not doc:
        raise HTTPException(404, "Document not found")

    file_path = settings.UPLOAD_DIR / doc.filename
    if not file_path.exists():
        raise HTTPException(404, "File not found on disk")

    doc.status = DocumentStatus.PENDING
    document_store.update(doc)
    background_tasks.add_task(_process_bg, doc, file_path)
    return {"doc_id": doc_id, "status": "reprocessing"}
