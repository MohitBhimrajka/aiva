"""merge mo and resume branch migrations

Revision ID: fed4905e6eb7
Revises: 7ef271b3f4ea, a1b2c3d4e5f6
Create Date: 2025-11-16 23:36:52.039595

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fed4905e6eb7'
down_revision: Union[str, Sequence[str], None] = ('7ef271b3f4ea', 'a1b2c3d4e5f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
