from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.schemas.session_schema import (
    BreakPreferenceCreate,
    BreakPreferenceResponse,
    HistoryEntryCreate,
    HistoryEntryResponse,
    SessionCreate,
    SessionResponse,
    SessionUpdate,
)
from app.schemas.user_schema import TokenData
from app.services.task_service import BreakPreferenceService, HistoryService, SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    session_in: SessionCreate,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SessionService(db)
    existing = await service.get_active_session(current_user.user_id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Active session already exists")

    session = await service.create_session(current_user.user_id, session_in)
    return session


@router.get("/active", response_model=Optional[SessionResponse])
async def get_active_session(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SessionService(db)
    session = await service.get_active_session(current_user.user_id)
    return session


@router.patch("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    session_in: SessionUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SessionService(db)
    session = await service.update_session(current_user.user_id, session_id, session_in)
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def end_session(
    session_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SessionService(db)
    success = await service.end_session(current_user.user_id, session_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")


@router.post("/history", response_model=HistoryEntryResponse, status_code=status.HTTP_201_CREATED)
async def create_history_entry(
    entry_in: HistoryEntryCreate,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = HistoryService(db)
    entry = await service.create_entry(current_user.user_id, entry_in)
    return entry


@router.get("/history", response_model=list[HistoryEntryResponse])
async def list_history(
    task_id: str | None = None,
    limit: int = 100,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = HistoryService(db)
    entries = await service.list_entries(current_user.user_id, task_id, limit)
    return entries


@router.post("/break-preferences", response_model=BreakPreferenceResponse, status_code=status.HTTP_201_CREATED)
async def create_break_preference(
    pref_in: BreakPreferenceCreate,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = BreakPreferenceService(db)
    pref = await service.create_preference(current_user.user_id, pref_in)
    return pref


@router.get("/break-preferences", response_model=list[BreakPreferenceResponse])
async def list_break_preferences(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = BreakPreferenceService(db)
    prefs = await service.list_preferences(current_user.user_id)
    return prefs


@router.delete("/break-preferences/{pref_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_break_preference(
    pref_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = BreakPreferenceService(db)
    success = await service.delete_preference(current_user.user_id, pref_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Preference not found")
