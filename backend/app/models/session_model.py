import enum

from sqlalchemy import Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SessionPhase(str, enum.Enum):
    RUNNING = "running"
    DECISION = "decision"
    POST_FOCUS = "post-focus"
    BREAK = "break"
    BREAK_DONE = "break-done"
    FINISHED = "finished"


class FocusScope(str, enum.Enum):
    WHOLE = "whole"
    SLICES = "slices"


class FocusSession(Base):
    __tablename__ = "focus_sessions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    phase: Mapped[SessionPhase] = mapped_column(Enum(SessionPhase), nullable=False)
    scope: Mapped[FocusScope] = mapped_column(Enum(FocusScope), default=FocusScope.WHOLE, nullable=False)
    selected_slice_ids: Mapped[str] = mapped_column(Text, default="")
    started_at: Mapped[int] = mapped_column(Integer, nullable=False)
    ends_at: Mapped[int] = mapped_column(Integer, nullable=False)
    original_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    extension_minutes: Mapped[int] = mapped_column(Integer, default=0)
    extensions: Mapped[int] = mapped_column(Integer, default=0)
    break_type: Mapped[str] = mapped_column(String(50), default="")
    credited_seconds: Mapped[int] = mapped_column(Integer, default=0)
    excluded_seconds: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[int] = mapped_column(Integer, nullable=False)

    owner = relationship("User", back_populates="sessions")
    task = relationship("Task")

    @staticmethod
    def generate_id() -> str:
        import uuid
        return str(uuid.uuid4())[:32]


class HistoryEntry(Base):
    __tablename__ = "history"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    seconds: Mapped[int] = mapped_column(Integer, nullable=False)
    at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    slice_ids: Mapped[str] = mapped_column(Text, default="")

    owner = relationship("User", back_populates="history")
    task = relationship("Task")

    @staticmethod
    def generate_id() -> str:
        import uuid
        return str(uuid.uuid4())[:32]


class BreakPreference(Base):
    __tablename__ = "break_preferences"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)

    owner = relationship("User", back_populates="break_preferences")

    @staticmethod
    def generate_id() -> str:
        import uuid
        return str(uuid.uuid4())[:32]


Index("ix_history_owner_at", HistoryEntry.owner_id, HistoryEntry.at)
Index("ix_sessions_owner_task", FocusSession.owner_id, FocusSession.task_id)
