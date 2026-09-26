"""Baseline idempotente para bancos existentes e instalações novas.

Revision ID: 0001_baseline
Revises:
"""
from alembic import op
from app.core.database import Base
import app.models.user_model  # noqa: F401
import app.models.task_model  # noqa: F401
import app.models.session_model  # noqa: F401
import app.models.google_connection_model  # noqa: F401

revision = '0001_baseline'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade():
    raise RuntimeError('O downgrade apagaria dados; restaure um backup em vez disso.')
