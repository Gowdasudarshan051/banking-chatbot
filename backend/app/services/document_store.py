"""
Simple in-memory document registry.
In production, swap for a PostgreSQL table via SQLAlchemy.
"""
from app.models.document import DocumentRecord


class DocumentStore:
    def __init__(self):
        self._docs: dict[str, DocumentRecord] = {}

    def add(self, record: DocumentRecord) -> None:
        self._docs[record.id] = record

    def get(self, doc_id: str) -> DocumentRecord | None:
        return self._docs.get(doc_id)

    def all(self) -> list[DocumentRecord]:
        return sorted(self._docs.values(), key=lambda d: d.uploaded_at, reverse=True)

    def update(self, record: DocumentRecord) -> None:
        self._docs[record.id] = record

    def delete(self, doc_id: str) -> bool:
        return bool(self._docs.pop(doc_id, None))


document_store = DocumentStore()
