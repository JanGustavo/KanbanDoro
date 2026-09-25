
from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    ai_provider: str | None = None
    ai_api_key: str | None = None


class UserUpdate(BaseModel):
    ai_provider: str | None = None
    ai_api_key: str | None = None


class UserResponse(UserBase):
    id: int
    ai_provider: str | None = None
    created_at: int
    updated_at: int

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: int
