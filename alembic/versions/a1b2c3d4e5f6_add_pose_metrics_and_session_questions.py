"""add pose metrics and session questions

Revision ID: a1b2c3d4e5f6
Revises: 3efb8cad14a7
Create Date: 2025-01-15 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '3efb8cad14a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add posture_stability_score to answers table
    op.add_column('answers', sa.Column('posture_stability_score', sa.Float(), nullable=True))
    
    # Add session_questions to interview_sessions table
    op.add_column('interview_sessions', sa.Column('session_questions', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove session_questions from interview_sessions table
    op.drop_column('interview_sessions', 'session_questions')
    
    # Remove posture_stability_score from answers table
    op.drop_column('answers', 'posture_stability_score')

