"""
OneDrive integration routes — Admin and TeamLead access.
"""
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from app.core.config import settings
from app.core.security import require_teamlead
from app.models.document import DocumentRecord, DocumentSource, DocumentStatus
from app.models.user import UserInDB
from app.services.document_processor import process_document
from app.services.document_store import document_store
from app.services.onedrive_service import list_files, download_file, OneDriveFile

router = APIRouter()


@router.get("/files")
async def onedrive_list_files(
    folder: str = "/",
    current_user: UserInDB = Depends(require_teamlead),
):
    """List files available in OneDrive (or mock)."""
    files = await list_files(folder_path=folder)
    return {
        "mode": "mock" if settings.USE_MOCK_ONEDRIVE else "graph",
        "files": [f.model_dump() for f in files],
    }


class ImportRequest(BaseModel):
    file_ids: list[str]


@router.post("/import", status_code=202)
async def import_files(
    payload: ImportRequest,
    background_tasks: BackgroundTasks,
    current_user: UserInDB = Depends(require_teamlead),
):
    """Download selected files from OneDrive and process them."""
    available = {f.id: f for f in await list_files()}
    results = []

    for file_id in payload.file_ids:
        od_file = available.get(file_id)
        if not od_file:
            results.append({"file_id": file_id, "error": "File not found"})
            continue

        doc_id = str(uuid.uuid4())
        suffix = Path(od_file.name).suffix.lower()
        dest = settings.UPLOAD_DIR / f"{doc_id}{suffix}"

        # Download to upload dir
        try:
            local_path = await download_file(od_file, settings.UPLOAD_DIR)
            # Rename to doc_id-based name
            local_path.rename(dest)
        except Exception as e:
            results.append({"file_id": file_id, "error": str(e)})
            continue

        source = DocumentSource.MOCK if settings.USE_MOCK_ONEDRIVE else DocumentSource.ONEDRIVE
        record = DocumentRecord(
            id=doc_id,
            filename=dest.name,
            original_name=od_file.name,
            file_type=suffix,
            source=source,
            uploaded_by=current_user.username,
            size_bytes=od_file.size,
        )
        document_store.add(record)
        background_tasks.add_task(_process_bg, record, dest)
        results.append({"file_id": file_id, "doc_id": doc_id, "status": "queued"})

    return {"imported": results}


async def _process_bg(record: DocumentRecord, path: Path):
    updated = await process_document(record, path)
    document_store.update(updated)
