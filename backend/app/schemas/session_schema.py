from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.session_model import FocusScope, SessionPhase


class SessionBase(BaseModel):
    task_id: str
    scope: FocusScope = FocusScope.WHOLE
    selected_slice_ids: list[str] = Field(default_factory=list)
    original_minutes: int = Field(..., ge=1, le=480)
    break_type: str = ""


class SessionCreate(SessionBase):
    pass


class ExtendRequest(BaseModel):
    minutes: int = Field(..., ge=1)


class ResolveRequest(BaseModel):
    outcome: str = Field(..., pattern="^(completed|failed|interrupted)$")


class BreakRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    minutes: int = Field(..., ge=1, le=120)


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

    @field_validator("selected_slice_ids", mode="before")
    @classmethod
    def split_slice_ids(cls, value: object) -> object:
        return value.split(",") if isinstance(value, str) and value else value if value else []

    model_config = ConfigDict(from_attributes=True)


class HistoryEntryBase(BaseModel):
    task_id: str
    kind: str
    seconds: int
    slice_ids: list[str] = Field(default_factory=list)


class HistoryEntryCreate(HistoryEntryBase):
    pass


class HistoryEntryResponse(HistoryEntryBase):
    id: str
    at: int

    @field_validator("slice_ids", mode="before")
    @classmethod
    def split_slice_ids(cls, value: object) -> object:
        return value.split(",") if isinstance(value, str) and value else value if value else []

    model_config = ConfigDict(from_attributes=True)


class BreakPreferenceBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


class BreakPreferenceCreate(BreakPreferenceBase):
    pass


class BreakPreferenceResponse(BreakPreferenceBase):
    id: str
    created_at: int

    model_config = ConfigDict(from_attributes=True)
