from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.session_model import BreakPreference, FocusSession, HistoryEntry, SessionPhase
from app.models.task_model import Slice, Task
from app.schemas.session_schema import (
    BreakPreferenceCreate,
    HistoryEntryCreate,
    SessionCreate,
    SessionUpdate,
)
from app.schemas.task_schema import SliceCreate, SliceUpdate, TaskCreate, TaskUpdate


class TaskService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_task(self, owner_id: int, task_in: TaskCreate) -> Task:
        now = int(datetime.utcnow().timestamp())
        task = Task(
            id=Task.generate_id(),
            owner_id=owner_id,
            name=task_in.name,
            description=task_in.description,
            difficulty=task_in.difficulty,
            estimate=task_in.estimate,
            deadline=task_in.deadline,
            column=task_in.column,
            created_at=now,
            updated_at=now,
        )
        self.db.add(task)
        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def get_task(self, owner_id: int, task_id: str) -> Task | None:
        result = await self.db.execute(
            select(Task)
            .where(Task.id == task_id, Task.owner_id == owner_id)
            .options(selectinload(Task.slices))
        )
        return result.scalar_one_or_none()

    async def list_tasks(self, owner_id: int) -> list[Task]:
        result = await self.db.execute(
            select(Task)
            .where(Task.owner_id == owner_id)
            .options(selectinload(Task.slices))
            .order_by(Task.created_at)
        )
        return list(result.scalars().all())

    async def update_task(self, owner_id: int, task_id: str, task_in: TaskUpdate) -> Task | None:
        task = await self.get_task(owner_id, task_id)
        if not task:
            return None

        update_data = task_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(task, field, value)
        task.updated_at = int(datetime.utcnow().timestamp())

        await self.db.commit()
        await self.db.refresh(task)
        return task

    async def delete_task(self, owner_id: int, task_id: str) -> bool:
        task = await self.get_task(owner_id, task_id)
        if not task:
            return False
        await self.db.delete(task)
        await self.db.commit()
        return True

    @staticmethod
    def generate_id() -> str:
        import uuid
        return str(uuid.uuid4())[:32]


class SliceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_slice(self, owner_id: int, task_id: str, slice_in: SliceCreate) -> Slice | None:
        result = await self.db.execute(
            select(Task).where(Task.id == task_id, Task.owner_id == owner_id)
        )
        task = result.scalar_one_or_none()
        if not task:
            return None

        now = int(datetime.utcnow().timestamp())
        slice_obj = Slice(
            id=Slice.generate_id(),
            task_id=task_id,
            name=slice_in.name,
            created_at=now,
        )
        self.db.add(slice_obj)
        await self.db.commit()
        await self.db.refresh(slice_obj)
        return slice_obj

    async def update_slice(self, owner_id: int, task_id: str, slice_id: str, slice_in: SliceUpdate) -> Slice | None:
        result = await self.db.execute(
            select(Slice)
            .join(Task)
            .where(Slice.id == slice_id, Task.id == task_id, Task.owner_id == owner_id)
        )
        slice_obj = result.scalar_one_or_none()
        if not slice_obj:
            return None

        update_data = slice_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(slice_obj, field, value)

        await self.db.commit()
        await self.db.refresh(slice_obj)
        return slice_obj

    async def delete_slice(self, owner_id: int, task_id: str, slice_id: str) -> bool:
        result = await self.db.execute(
            select(Slice)
            .join(Task)
            .where(Slice.id == slice_id, Task.id == task_id, Task.owner_id == owner_id)
        )
        slice_obj = result.scalar_one_or_none()
        if not slice_obj:
            return False
        await self.db.delete(slice_obj)
        await self.db.commit()
        return True


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_session(self, owner_id: int, session_in: SessionCreate) -> FocusSession:
        now = int(datetime.utcnow().timestamp())
        session = FocusSession(
            id=FocusSession.generate_id(),
            owner_id=owner_id,
            task_id=session_in.task_id,
            phase=SessionPhase.RUNNING,
            scope=session_in.scope,
            selected_slice_ids=",".join(session_in.selected_slice_ids),
            started_at=now,
            ends_at=now + session_in.original_minutes * 60000,
            original_minutes=session_in.original_minutes,
            break_type=session_in.break_type,
            created_at=now,
            updated_at=now,
        )
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def get_active_session(self, owner_id: int) -> FocusSession | None:
        result = await self.db.execute(
            select(FocusSession)
            .where(
                FocusSession.owner_id == owner_id,
                FocusSession.phase.in_([
                    SessionPhase.RUNNING,
                    SessionPhase.DECISION,
                    SessionPhase.POST_FOCUS,
                    SessionPhase.BREAK,
                    SessionPhase.BREAK_DONE,
                ])
            )
            .order_by(FocusSession.created_at.desc())
        )
        return result.scalar_one_or_none()

    async def update_session(self, owner_id: int, session_id: str, session_in: SessionUpdate) -> FocusSession | None:
        result = await self.db.execute(
            select(FocusSession).where(FocusSession.id == session_id, FocusSession.owner_id == owner_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            return None

        update_data = session_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(session, field, value)
        session.updated_at = int(datetime.utcnow().timestamp())

        await self.db.commit()
        await self.db.refresh(session)
        return session

    async def end_session(self, owner_id: int, session_id: str) -> bool:
        result = await self.db.execute(
            select(FocusSession).where(FocusSession.id == session_id, FocusSession.owner_id == owner_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            return False
        await self.db.delete(session)
        await self.db.commit()
        return True


class HistoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_entry(self, owner_id: int, entry_in: HistoryEntryCreate) -> HistoryEntry:
        now = int(datetime.utcnow().timestamp())
        entry = HistoryEntry(
            id=HistoryEntry.generate_id(),
            owner_id=owner_id,
            task_id=entry_in.task_id,
            kind=entry_in.kind,
            seconds=entry_in.seconds,
            at=now,
            slice_ids=",".join(entry_in.slice_ids),
        )
        self.db.add(entry)
        await self.db.commit()
        await self.db.refresh(entry)
        return entry

    async def list_entries(self, owner_id: int, task_id: str | None = None, limit: int = 100) -> list[HistoryEntry]:
        query = select(HistoryEntry).where(HistoryEntry.owner_id == owner_id)
        if task_id:
            query = query.where(HistoryEntry.task_id == task_id)
        query = query.order_by(HistoryEntry.at.desc()).limit(limit)
        result = await self.db.execute(query)
        return list(result.scalars().all())


class BreakPreferenceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_preference(self, owner_id: int, pref_in: BreakPreferenceCreate) -> BreakPreference:
        now = int(datetime.utcnow().timestamp())
        pref = BreakPreference(
            id=BreakPreference.generate_id(),
            owner_id=owner_id,
            name=pref_in.name,
            created_at=now,
        )
        self.db.add(pref)
        await self.db.commit()
        await self.db.refresh(pref)
        return pref

    async def list_preferences(self, owner_id: int) -> list[BreakPreference]:
        result = await self.db.execute(
            select(BreakPreference)
            .where(BreakPreference.owner_id == owner_id)
            .order_by(BreakPreference.created_at)
        )
        return list(result.scalars().all())

    async def delete_preference(self, owner_id: int, pref_id: str) -> bool:
        result = await self.db.execute(
            select(BreakPreference).where(BreakPreference.id == pref_id, BreakPreference.owner_id == owner_id)
        )
        pref = result.scalar_one_or_none()
        if not pref:
            return False
        await self.db.delete(pref)
        await self.db.commit()
        return True
