from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.session_model import HistoryEntry
from app.schemas.session_schema import (
    BreakPreferenceCreate,
    BreakPreferenceResponse,
    BreakRequest,
    ExtendRequest,
    HistoryEntryResponse,
    ResolveRequest,
    SessionCreate,
    SessionResponse,
)
from app.schemas.user_schema import TokenData
from app.services.session_service import BreakPreferenceService, SessionService

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(payload: SessionCreate, user: TokenData = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    return await SessionService(db).create(user.user_id, payload.task_id, payload.scope,
                                           payload.selected_slice_ids, payload.original_minutes)


@router.get("/active", response_model=SessionResponse | None)
async def active_session(user: TokenData = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    return await SessionService(db).active(user.user_id)


@router.get("/history", response_model=list[HistoryEntryResponse])
async def history(task_id: str | None = None, limit: int = Query(100, ge=1, le=500),
                  user: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    query = select(HistoryEntry).where(HistoryEntry.owner_id == user.user_id)
    if task_id:
        query = query.where(HistoryEntry.task_id == task_id)
    result = await db.execute(query.order_by(HistoryEntry.at.desc()).limit(limit))
    return list(result.scalars())


@router.post("/{session_id}/extend", response_model=SessionResponse)
async def extend(session_id: str, payload: ExtendRequest,
                 user: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await SessionService(db).extend(user.user_id, session_id, payload.minutes)


@router.post("/{session_id}/resolve", response_model=SessionResponse)
async def resolve(session_id: str, payload: ResolveRequest,
                  user: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await SessionService(db).resolve(user.user_id, session_id, payload.outcome)


@router.post("/{session_id}/break", response_model=SessionResponse)
async def start_break(session_id: str, payload: BreakRequest,
                      user: TokenData = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await SessionService(db).start_break(user.user_id, session_id, payload.name, payload.minutes)


@router.post("/{session_id}/finish", response_model=SessionResponse)
async def finish(session_id: str, user: TokenData = Depends(get_current_user),
                 db: AsyncSession = Depends(get_db)):
    return await SessionService(db).finish_break(user.user_id, session_id)


@router.post("/break-preferences", response_model=BreakPreferenceResponse,
             status_code=status.HTTP_201_CREATED)
async def create_break_preference(payload: BreakPreferenceCreate,
                                  user: TokenData = Depends(get_current_user),
                                  db: AsyncSession = Depends(get_db)):
    return await BreakPreferenceService(db).create(user.user_id, payload.name)


@router.get("/break-preferences", response_model=list[BreakPreferenceResponse])
async def list_break_preferences(user: TokenData = Depends(get_current_user),
                                 db: AsyncSession = Depends(get_db)):
    return await BreakPreferenceService(db).list(user.user_id)


@router.delete("/break-preferences/{pref_id}", status_code=204)
async def delete_break_preference(pref_id: str, user: TokenData = Depends(get_current_user),
                                  db: AsyncSession = Depends(get_db)):
    await BreakPreferenceService(db).delete(user.user_id, pref_id)
