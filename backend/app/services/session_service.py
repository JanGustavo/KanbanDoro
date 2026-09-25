import time

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session_model import (
    BreakPreference,
    FocusScope,
    FocusSession,
    HistoryEntry,
    SessionPhase,
)
from app.models.task_model import ColumnEnum, Slice, Task


def seconds_now() -> int:
    return int(time.time())


def millis_now() -> int:
    return int(time.time() * 1000)


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def active(self, owner_id: int) -> FocusSession | None:
        result = await self.db.execute(
            select(FocusSession).where(
                FocusSession.owner_id == owner_id,
                FocusSession.phase != SessionPhase.FINISHED,
            ).order_by(FocusSession.created_at.desc()).limit(1)
        )
        return result.scalar_one_or_none()

    async def owned(self, owner_id: int, session_id: str) -> FocusSession:
        session = await self.db.scalar(select(FocusSession).where(
            FocusSession.owner_id == owner_id, FocusSession.id == session_id
        ))
        if session is None:
            raise HTTPException(404, "Session not found")
        return session

    async def create(self, owner_id: int, task_id: str, scope: FocusScope,
                     slice_ids: list[str], duration: int) -> FocusSession:
        if await self.active(owner_id):
            raise HTTPException(409, "An active session already exists")
        task = await self.db.scalar(select(Task).where(Task.owner_id == owner_id, Task.id == task_id))
        if task is None or task.column == ColumnEnum.DONE:
            raise HTTPException(404, "Available task not found")
        if scope == FocusScope.SLICES:
            if not slice_ids or len(set(slice_ids)) != len(slice_ids):
                raise HTTPException(422, "Select distinct slices")
            result = await self.db.execute(select(Slice.id).where(
                Slice.task_id == task_id, Slice.id.in_(slice_ids), Slice.done.is_(False)
            ))
            if set(result.scalars()) != set(slice_ids):
                raise HTTPException(422, "Slices must belong to the task and be pending")
        elif slice_ids:
            raise HTTPException(422, "Whole-task cycles cannot select slices")

        now = millis_now()
        session = FocusSession(
            id=FocusSession.generate_id(), owner_id=owner_id, task_id=task_id,
            phase=SessionPhase.RUNNING, scope=scope, selected_slice_ids=",".join(slice_ids),
            started_at=now, ends_at=now + duration * 60_000,
            original_minutes=duration, break_type="", created_at=seconds_now(),
            updated_at=seconds_now(),
        )
        task.column = ColumnEnum.DOING
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def extend(self, owner_id: int, session_id: str, minutes: int) -> FocusSession:
        session = await self.owned(owner_id, session_id)
        if session.phase not in (SessionPhase.RUNNING, SessionPhase.DECISION) or millis_now() < session.ends_at:
            raise HTTPException(409, "Focus has not reached its end")
        if session.extensions >= 2 or session.extension_minutes + minutes > session.original_minutes // 2:
            raise HTTPException(422, "Extension limit exceeded")
        now = millis_now()
        session.excluded_seconds += max(0, (now - session.ends_at) // 1000)
        session.ends_at = max(now, session.ends_at) + minutes * 60_000
        session.extension_minutes += minutes
        session.extensions += 1
        session.phase = SessionPhase.RUNNING
        session.updated_at = seconds_now()
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def resolve(self, owner_id: int, session_id: str, outcome: str) -> FocusSession:
        session = await self.owned(owner_id, session_id)
        if session.phase not in (SessionPhase.RUNNING, SessionPhase.DECISION):
            raise HTTPException(409, "Focus already resolved")
        if outcome == "failed" and millis_now() < session.ends_at:
            raise HTTPException(409, "Focus is still running")
        task = await self.db.scalar(select(Task).where(Task.id == session.task_id, Task.owner_id == owner_id))
        if task is None:
            raise HTTPException(404, "Task not found")
        elapsed = max(0, (min(millis_now(), session.ends_at) - session.started_at) // 1000)
        credited = max(0, elapsed - session.excluded_seconds)
        task.focus_seconds += credited
        if outcome == "failed":
            task.failures += 1
            task.column = ColumnEnum.LATE
        elif outcome == "completed":
            if session.scope == FocusScope.WHOLE:
                task.column = ColumnEnum.DONE
            else:
                selected_ids = session.selected_slice_ids.split(",")
                result = await self.db.execute(select(Slice).where(Slice.task_id == task.id))
                slices = list(result.scalars())
                for item in slices:
                    if item.id in selected_ids:
                        item.done = True
                task.column = (
                    ColumnEnum.DONE if slices and all(item.done for item in slices)
                    else ColumnEnum.DOING
                )
        session.credited_seconds = credited
        session.phase = SessionPhase.FINISHED if outcome == "interrupted" else SessionPhase.POST_FOCUS
        session.updated_at = seconds_now()
        self.db.add(HistoryEntry(
            id=HistoryEntry.generate_id(), owner_id=owner_id, task_id=task.id,
            kind=outcome, seconds=credited, at=seconds_now(), slice_ids=session.selected_slice_ids,
        ))
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def start_break(self, owner_id: int, session_id: str, name: str,
                          minutes: int) -> FocusSession:
        session = await self.owned(owner_id, session_id)
        if session.phase != SessionPhase.POST_FOCUS:
            raise HTTPException(409, "Finish focus before starting a break")
        now = millis_now()
        session.phase = SessionPhase.BREAK
        session.break_type = name
        session.started_at = now
        session.ends_at = now + minutes * 60_000
        session.updated_at = seconds_now()
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def finish_break(self, owner_id: int, session_id: str) -> FocusSession:
        session = await self.owned(owner_id, session_id)
        if session.phase not in (SessionPhase.BREAK, SessionPhase.POST_FOCUS):
            raise HTTPException(409, "No break to finish")
        session.phase = SessionPhase.FINISHED
        session.updated_at = seconds_now()
        await self.db.commit()
        await self.db.refresh(session)
        return session


class BreakPreferenceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, owner_id: int, name: str) -> BreakPreference:
        existing = await self.db.scalar(select(BreakPreference).where(
            BreakPreference.owner_id == owner_id, BreakPreference.name == name
        ))
        if existing:
            raise HTTPException(409, "Preference already exists")
        pref = BreakPreference(id=BreakPreference.generate_id(), owner_id=owner_id,
                               name=name, created_at=seconds_now())
        self.db.add(pref)
        await self.db.commit()
        await self.db.refresh(pref)
        return pref

    async def list(self, owner_id: int) -> list[BreakPreference]:
        result = await self.db.execute(select(BreakPreference).where(
            BreakPreference.owner_id == owner_id).order_by(BreakPreference.created_at))
        return list(result.scalars())

    async def delete(self, owner_id: int, pref_id: str) -> None:
        pref = await self.db.scalar(select(BreakPreference).where(
            BreakPreference.owner_id == owner_id, BreakPreference.id == pref_id))
        if pref is None:
            raise HTTPException(404, "Preference not found")
        await self.db.delete(pref)
        await self.db.commit()
