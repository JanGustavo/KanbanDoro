from pydantic import BaseModel, ConfigDict, Field

from app.models.task_model import ColumnEnum


class SliceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class SliceCreate(SliceBase):
    pass


class SliceUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    done: bool | None = None


class SliceResponse(SliceBase):
    id: str
    done: bool
    created_at: int

    model_config = ConfigDict(from_attributes=True)


class TaskBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str = ""
    difficulty: int = Field(default=1, ge=1, le=3)
    estimate: int = Field(default=25, ge=1, le=480)
    deadline: str | None = None
    column: ColumnEnum = ColumnEnum.TODO


class TaskCreate(TaskBase):
    pass


class TaskUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    difficulty: int | None = Field(None, ge=1, le=3)
    estimate: int | None = Field(None, ge=1, le=480)
    deadline: str | None = None
    column: ColumnEnum | None = None


class TaskResponse(TaskBase):
    id: str
    failures: int
    focus_seconds: int
    slices: list[SliceResponse] = []
    created_at: int
    updated_at: int

    model_config = ConfigDict(from_attributes=True)
