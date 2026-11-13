"""demo bookings

Revision ID: e7b3c9a1d204
Revises: c41e9a7d2f15
Create Date: 2026-11-13 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e7b3c9a1d204'
down_revision: Union[str, None] = 'c41e9a7d2f15'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'demo_bookings',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('starts_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('ends_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('email', sa.String(length=200), nullable=False),
        sa.Column('business', sa.String(length=200), nullable=False),
        sa.Column('phone', sa.String(length=40), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='confirmed'),
        sa.Column('cancel_token', sa.String(length=64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'uq_demo_bookings_confirmed_start',
        'demo_bookings',
        ['starts_at'],
        unique=True,
        postgresql_where=sa.text("status = 'confirmed'"),
    )


def downgrade() -> None:
    op.drop_index('uq_demo_bookings_confirmed_start', table_name='demo_bookings')
    op.drop_table('demo_bookings')
