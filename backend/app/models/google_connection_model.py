from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class GoogleConnection(Base):
    __tablename__ = "google_connections"

    id: Mapped[int] = mapped_column(primary_key=True)
    session_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    encrypted_refresh_token: Mapped[str] = mapped_column(String(2048))
    scopes: Mapped[str] = mapped_column(String(1024))
    access_token: Mapped[str] = mapped_column(String(2048))
    expires_at: Mapped[int] = mapped_column(Integer)
