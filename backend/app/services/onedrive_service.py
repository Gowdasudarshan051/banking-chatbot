"""
OneDrive Integration Service
─────────────────────────────
Real mode  : Microsoft Graph API (OAuth2 client credentials)
Mock mode  : Reads files from local MOCK_ONEDRIVE_DIR folder
Controlled by settings.USE_MOCK_ONEDRIVE
"""
from __future__ import annotations
import logging
import shutil
from pathlib import Path
from typing import List

import httpx
from pydantic import BaseModel

from app.core.config import settings

logger = logging.getLogger(__name__)

GRAPH_BASE     = "https://graph.microsoft.com/v1.0"
TOKEN_ENDPOINT = (
    f"https://login.microsoftonline.com/{settings.ONEDRIVE_TENANT_ID}/oauth2/v2.0/token"
)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".pptx", ".xlsx", ".png", ".jpg", ".jpeg", ".tiff"}


class OneDriveFile(BaseModel):
    id: str
    name: str
    size: int
    download_url: str | None = None


# ── Token Cache (process-level, fine for single-instance) ─────────────────────
_token_cache: dict[str, str] = {}


async def _get_access_token() -> str:
    """Obtain an app-only access token via client credentials flow."""
    if "token" in _token_cache:
        return _token_cache["token"]

    data = {
        "grant_type":    "client_credentials",
        "client_id":     settings.ONEDRIVE_CLIENT_ID,
        "client_secret": settings.ONEDRIVE_CLIENT_SECRET,
        "scope":         "https://graph.microsoft.com/.default",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(TOKEN_ENDPOINT, data=data)
        resp.raise_for_status()
        token = resp.json()["access_token"]
        _token_cache["token"] = token
        return token


# ── File Listing ──────────────────────────────────────────────────────────────

async def list_files(folder_path: str = "/") -> List[OneDriveFile]:
    """List supported files in OneDrive (real or mock)."""
    if settings.USE_MOCK_ONEDRIVE:
        return _mock_list_files()
    return await _graph_list_files(folder_path)


def _mock_list_files() -> List[OneDriveFile]:
    """Return files from the local mock_onedrive directory."""
    files = []
    for path in settings.MOCK_ONEDRIVE_DIR.iterdir():
        if path.suffix.lower() in ALLOWED_EXTENSIONS:
            files.append(
                OneDriveFile(
                    id=path.name,
                    name=path.name,
                    size=path.stat().st_size,
                    download_url=None,  # handled locally
                )
            )
    return files


async def _graph_list_files(folder_path: str) -> List[OneDriveFile]:
    token = await _get_access_token()
    headers = {"Authorization": f"Bearer {token}"}

    url = f"{GRAPH_BASE}/me/drive/root:{folder_path}:/children"
    files: List[OneDriveFile] = []

    async with httpx.AsyncClient() as client:
        while url:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            data = resp.json()

            for item in data.get("value", []):
                name = item["name"]
                if Path(name).suffix.lower() not in ALLOWED_EXTENSIONS:
                    continue
                files.append(
                    OneDriveFile(
                        id=item["id"],
                        name=name,
                        size=item.get("size", 0),
                        download_url=item.get("@microsoft.graph.downloadUrl"),
                    )
                )
            url = data.get("@odata.nextLink")   # pagination

    return files


# ── File Download ─────────────────────────────────────────────────────────────

async def download_file(file: OneDriveFile, dest_dir: Path) -> Path:
    """Download a file and save to dest_dir. Returns local path."""
    dest_path = dest_dir / file.name

    if settings.USE_MOCK_ONEDRIVE:
        src = settings.MOCK_ONEDRIVE_DIR / file.id
        shutil.copy2(src, dest_path)
        logger.info("Mock copy: %s → %s", src, dest_path)
        return dest_path

    # Real download
    token = await _get_access_token()
    if file.download_url:
        url = file.download_url
        headers: dict = {}
    else:
        url = f"{GRAPH_BASE}/me/drive/items/{file.id}/content"
        headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(follow_redirects=True) as client:
        async with client.stream("GET", url, headers=headers) as resp:
            resp.raise_for_status()
            with open(dest_path, "wb") as f:
                async for chunk in resp.aiter_bytes(chunk_size=8192):
                    f.write(chunk)

    logger.info("Downloaded from OneDrive: %s (%d bytes)", file.name, dest_path.stat().st_size)
    return dest_path
