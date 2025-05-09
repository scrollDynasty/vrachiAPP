"""create patient and doctor profiles tables

Revision ID: f953d9502fa1
Revises: ef3a8806b6bd
Create Date: 2025-05-02 22:29:05.421042

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f953d9502fa1'
down_revision: Union[str, None] = 'ef3a8806b6bd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('doctor_profiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=True),
    sa.Column('specialization', sa.String(length=255), nullable=False),
    sa.Column('experience', sa.String(length=255), nullable=True),
    sa.Column('education', sa.Text(), nullable=True),
    sa.Column('cost_per_consultation', sa.Integer(), nullable=False),
    sa.Column('practice_areas', sa.String(length=511), nullable=True),
    sa.Column('is_verified', sa.Boolean(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_doctor_profiles_id'), 'doctor_profiles', ['id'], unique=False)
    op.create_table('patient_profiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('full_name', sa.String(length=255), nullable=True),
    sa.Column('contact_phone', sa.String(length=50), nullable=True),
    sa.Column('contact_address', sa.String(length=255), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id')
    )
    op.create_index(op.f('ix_patient_profiles_id'), 'patient_profiles', ['id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    """Downgrade schema."""
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_patient_profiles_id'), table_name='patient_profiles')
    op.drop_table('patient_profiles')
    op.drop_index(op.f('ix_doctor_profiles_id'), table_name='doctor_profiles')
    op.drop_table('doctor_profiles')
    # ### end Alembic commands ###
