"""
Admin-only routes: user management and vector DB administration.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.security import require_admin, hash_password
from app.core.user_store import user_store
from app.core.vector_db import VectorDBManager
from app.models.user import UserInDB, UserCreate, UserPublic, Role

router = APIRouter()


# ── User Management ───────────────────────────────────────────────────────────

@router.get("/users", response_model=list[UserPublic])
async def list_users(current_user=Depends(require_admin)):
    return [
        UserPublic(username=u.username, full_name=u.full_name, role=u.role, is_active=u.is_active)
        for u in user_store.all()
    ]


@router.post("/users", response_model=UserPublic, status_code=201)
async def create_user(payload: UserCreate, current_user=Depends(require_admin)):
    if user_store.get(payload.username):
        raise HTTPException(400, f"User '{payload.username}' already exists")
    new_user = UserInDB(
        username=payload.username,
        full_name=payload.full_name,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    user_store.create(new_user)
    return UserPublic(**new_user.model_dump(exclude={"hashed_password"}))


@router.delete("/users/{username}", status_code=204)
async def delete_user(username: str, current_user=Depends(require_admin)):
    if username == current_user.username:
        raise HTTPException(400, "Cannot delete your own account")
    if not user_store.delete(username):
        raise HTTPException(404, f"User '{username}' not found")
    return None


# ── Vector DB ─────────────────────────────────────────────────────────────────

@router.get("/vector-db/stats")
async def vector_db_stats(current_user=Depends(require_admin)):
    return VectorDBManager.stats()


@router.post("/vector-db/reset", status_code=204)
async def reset_vector_db(current_user=Depends(require_admin)):
    """Wipe the entire FAISS index (irreversible)."""
    from app.core.config import settings
    import faiss, pickle

    VectorDBManager._index = faiss.IndexFlatIP(VectorDBManager._dim)
    VectorDBManager._metadata = []
    VectorDBManager._persist()
    return None
