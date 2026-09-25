import enum

from sqlalchemy import Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ColumnEnum(str, enum.Enum):
    TODO = "todo"
    DOING = "doing"
    LATE = "late"
    DONE = "done"


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="")
    difficulty: Mapped[int] = mapped_column(Integer, default=1)
    estimate: Mapped[int] = mapped_column(Integer, default=25)
    deadline: Mapped[str | None] = mapped_column(String(10), nullable=True)
    column: Mapped[ColumnEnum] = mapped_column(Enum(ColumnEnum), default=ColumnEnum.TODO, nullable=False)
    failures: Mapped[int] = mapped_column(Integer, default=0)
    focus_seconds: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[int] = mapped_column(Integer, nullable=False)

    owner = relationship("User", back_populates="tasks")
    slices = relationship("Slice", back_populates="task", cascade="all, delete-orphan", order_by="Slice.created_at")

    @staticmethod
    def generate_id() -> str:
        import uuid
        return str(uuid.uuid4())[:32]


class Slice(Base):
    __tablename__ = "slices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    task_id: Mapped[str] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    done: Mapped[bool] = mapped_column(default=False, nullable=False)
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)

    task = relationship("Task", back_populates="slices")

    @staticmethod
    def generate_id() -> str:
        import uuid
        return str(uuid.uuid4())[:32]


Index("ix_slices_task_id", Slice.task_id)
