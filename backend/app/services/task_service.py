from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task_model import Slice, Task
from app.schemas.task_schema import SliceCreate, SliceUpdate, TaskCreate, TaskUpdate


class TaskService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_task(self, owner_id: int, task_in: TaskCreate) -> Task:
        now = int(datetime.now(UTC).timestamp())
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
        return await self.get_task(owner_id, task.id)

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
        task.updated_at = int(datetime.now(UTC).timestamp())

        await self.db.commit()
        return await self.get_task(owner_id, task.id)

    async def delete_task(self, owner_id: int, task_id: str) -> bool:
        task = await self.get_task(owner_id, task_id)
        if not task:
            return False
        await self.db.delete(task)
        await self.db.commit()
        return True

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

        now = int(datetime.now(UTC).timestamp())
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
