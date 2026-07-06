"""
Banking Document-Aware Chatbot — FastAPI Backend
Entry point and app configuration.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from contextlib import asynccontextmanager
import logging

from app.core.config import settings
from app.core.vector_db import VectorDBManager
from app.api import auth, documents, chat, admin, onedrive

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown lifecycle."""
    logger.info("Initialising vector database …")
    await VectorDBManager.initialise()
    logger.info("Vector DB ready.")
    yield
    logger.info("Shutting down …")


app = FastAPI(
    title="Banking Document Chatbot API",
    version="1.0.0",
    description="Role-Based Document-Aware Chatbot for banking environments.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.ALLOWED_HOSTS)

app.include_router(auth.router,      prefix="/api/auth",      tags=["Authentication"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(chat.router,      prefix="/api/chat",      tags=["Chat"])
app.include_router(admin.router,     prefix="/api/admin",     tags=["Admin"])
app.include_router(onedrive.router,  prefix="/api/onedrive",  tags=["OneDrive"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}
