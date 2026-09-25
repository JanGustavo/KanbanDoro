from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.user_schema import TokenData
from app.services.auth_service import decode_token, get_user_by_id


async def get_current_user(
    token: str = Depends(OAuth2PasswordRequestForm),
    db: AsyncSession = Depends(get_db),
) -> TokenData:
    token_data = decode_token(token)
    if not token_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await get_user_by_id(db, token_data.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return token_data
