from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[int] = mapped_column(nullable=False)
    updated_at: Mapped[int] = mapped_column(nullable=False)

    tasks = relationship("Task", back_populates="owner", cascade="all, delete-orphan")
    sessions = relationship("FocusSession", back_populates="owner", cascade="all, delete-orphan")
    history = relationship("HistoryEntry", back_populates="owner", cascade="all, delete-orphan")
    break_preferences = relationship("BreakPreference", back_populates="owner", cascade="all, delete-orphan")
