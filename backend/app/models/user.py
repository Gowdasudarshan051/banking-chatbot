"""
User domain models.
"""
from enum import Enum
from pydantic import BaseModel
from typing import Optional


class Role(str, Enum):
    ADMIN    = "admin"
    TEAMLEAD = "teamlead"
    USER     = "user"


class UserBase(BaseModel):
    username: str
    full_name: str
    role: Role


class UserCreate(UserBase):
    password: str


class UserInDB(UserBase):
    hashed_password: str
    is_active: bool = True


class UserPublic(UserBase):
    is_active: bool

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    full_name: str


class TokenData(BaseModel):
    username: Optional[str] = None
    role: Optional[str]     = None
