"""
Document domain models.
"""
from enum import Enum
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class DocumentStatus(str, Enum):
    PENDING    = "pending"
    PROCESSING = "processing"
    READY      = "ready"
    FAILED     = "failed"


class DocumentSource(str, Enum):
    UPLOAD   = "upload"
    ONEDRIVE = "onedrive"
    MOCK     = "mock_onedrive"


class DocumentRecord(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    filename: str
    original_name: str
    file_type: str
    source: DocumentSource
    status: DocumentStatus = DocumentStatus.PENDING
    uploaded_by: str
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)
    chunk_count: int = 0
    error: Optional[str] = None
    size_bytes: int = 0


class DocumentList(BaseModel):
    documents: list[DocumentRecord]
    total: int
