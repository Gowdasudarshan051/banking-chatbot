"""
Application configuration — all settings via environment variables.
"""
from pydantic_settings import BaseSettings
from pathlib import Path
from typing import List
import secrets


BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "Banking Chatbot"
    SECRET_KEY: str = secrets.token_hex(32)
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # ── CORS / Hosts ──────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]
    ALLOWED_HOSTS: List[str] = ["*"]

    # ── File Storage ──────────────────────────────────────────────────────────
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    MOCK_ONEDRIVE_DIR: Path = BASE_DIR / "mock_onedrive"

    # ── FAISS ─────────────────────────────────────────────────────────────────
    FAISS_INDEX_PATH: Path = BASE_DIR / "faiss_index"
    CHUNK_SIZE: int = 512
    CHUNK_OVERLAP: int = 64
    TOP_K: int = 5

    # ── Embeddings ────────────────────────────────────────────────────────────
    EMBEDDING_MODEL: str = "sentence-transformers/all-MiniLM-L6-v2"
    USE_GPU: bool = True

    # ── Ollama / LLM ──────────────────────────────────────────────────────────
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "mistral"
    OLLAMA_TIMEOUT: int = 120

    # ── Microsoft Graph / OneDrive ────────────────────────────────────────────
    ONEDRIVE_CLIENT_ID: str = ""
    ONEDRIVE_CLIENT_SECRET: str = ""
    ONEDRIVE_TENANT_ID: str = ""
    ONEDRIVE_REDIRECT_URI: str = "http://localhost:8000/api/onedrive/callback"
    USE_MOCK_ONEDRIVE: bool = True   # set False when real credentials are ready

    # ── Tesseract OCR ─────────────────────────────────────────────────────────
    TESSERACT_CMD: str = "tesseract"

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

# Ensure directories exist
for d in (settings.UPLOAD_DIR, settings.MOCK_ONEDRIVE_DIR, settings.FAISS_INDEX_PATH):
    d.mkdir(parents=True, exist_ok=True)
