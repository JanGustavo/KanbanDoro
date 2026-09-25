from enum import Enum

from pydantic import BaseModel, Field


class SessionPhase(str, Enum):
    RUNNING = "running"
    DECISION = "decision"
    POST_FOCUS = "post-focus"
    BREAK = "break"
    BREAK_DONE = "break-done"


class FocusScope(str, Enum):
    WHOLE = "whole"
    SLICES = "slices"


class SessionBase(BaseModel):
    task_id: str
    scope: FocusScope = FocusScope.WHOLE
    selected_slice_ids: list[str] = []
    original_minutes: int = Field(..., ge=1, le=480)
    break_type: str = ""


class SessionCreate(SessionBase):
    pass


class SessionUpdate(BaseModel):
    phase: SessionPhase | None = None
    ends_at: int | None = None
    extension_minutes: int | None = None
    extensions: int | None = None
    break_type: str | None = None
    credited_seconds: int | None = None
    excluded_seconds: int | None = None


class SessionResponse(SessionBase):
    id: str
    phase: SessionPhase
    started_at: int
    ends_at: int
    extension_minutes: int
    extensions: int
    credited_seconds: int
    excluded_seconds: int
    created_at: int
    updated_at: int

    class Config:
        from_attributes = True


class HistoryEntryBase(BaseModel):
    task_id: str
    kind: str
    seconds: int
    slice_ids: list[str] = []


class HistoryEntryCreate(HistoryEntryBase):
    pass


class HistoryEntryResponse(HistoryEntryBase):
    id: str
    at: int

    class Config:
        from_attributes = True


class BreakPreferenceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class BreakPreferenceCreate(BreakPreferenceBase):
    pass


class BreakPreferenceResponse(BreakPreferenceBase):
    id: str
    created_at: int

    class Config:
        from_attributes = True
