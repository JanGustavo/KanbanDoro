
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.schemas.task_schema import (
    SliceCreate,
    SliceResponse,
    SliceUpdate,
    TaskCreate,
    TaskResponse,
    TaskUpdate,
)
from app.schemas.user_schema import TokenData
from app.services.task_service import SliceService, TaskService

router = APIRouter(prefix="/tasks", tags=["tasks"])


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task_in: TaskCreate,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)
    task = await service.create_task(current_user.user_id, task_in)
    return task


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)
    tasks = await service.list_tasks(current_user.user_id)
    return tasks


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)
    task = await service.get_task(current_user.user_id, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_in: TaskUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)
    task = await service.update_task(current_user.user_id, task_id, task_in)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)
    success = await service.delete_task(current_user.user_id, task_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")


@router.post("/{task_id}/slices", response_model=SliceResponse, status_code=status.HTTP_201_CREATED)
async def create_slice(
    task_id: str,
    slice_in: SliceCreate,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SliceService(db)
    slice_obj = await service.create_slice(current_user.user_id, task_id, slice_in)
    if not slice_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return slice_obj


@router.patch("/{task_id}/slices/{slice_id}", response_model=SliceResponse)
async def update_slice(
    task_id: str,
    slice_id: str,
    slice_in: SliceUpdate,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SliceService(db)
    slice_obj = await service.update_slice(current_user.user_id, task_id, slice_id, slice_in)
    if not slice_obj:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slice not found")
    return slice_obj


@router.delete("/{task_id}/slices/{slice_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_slice(
    task_id: str,
    slice_id: str,
    current_user: TokenData = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = SliceService(db)
    success = await service.delete_slice(current_user.user_id, task_id, slice_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Slice not found")
