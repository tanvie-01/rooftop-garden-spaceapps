"""community: profiles, posts, images, reactions, comments, saves, shares

Revision ID: b7c1e2d4a9f0
Revises: 29670d30d3e5
Create Date: 2026-11-05 22:00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'b7c1e2d4a9f0'
down_revision: Union[str, None] = '29670d30d3e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _link(name: str, uq: str):
    op.create_table(name,
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('post_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('post_id', 'user_id', name=uq)
    )
    op.create_index(op.f(f'ix_{name}_post_id'), name, ['post_id'], unique=False)
    op.create_index(op.f(f'ix_{name}_user_id'), name, ['user_id'], unique=False)


def upgrade() -> None:
    op.create_table('community_profiles',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('avatar', sa.String(), nullable=False),
    sa.Column('background', sa.String(), nullable=False),
    sa.Column('name', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.Column('updated_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_community_profiles_user_id'), 'community_profiles', ['user_id'], unique=True)
    op.create_table('community_posts',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('caption', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_community_posts_user_id'), 'community_posts', ['user_id'], unique=False)
    op.create_index(op.f('ix_community_posts_created_at'), 'community_posts', ['created_at'], unique=False)
    op.create_table('community_post_images',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('post_id', sa.Integer(), nullable=False),
    sa.Column('position', sa.Integer(), nullable=True),
    sa.Column('feed_key', sa.String(), nullable=False),
    sa.Column('full_key', sa.String(), nullable=False),
    sa.Column('width', sa.Integer(), nullable=False),
    sa.Column('height', sa.Integer(), nullable=False),
    sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_community_post_images_post_id'), 'community_post_images', ['post_id'], unique=False)
    op.create_table('community_reactions',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('post_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('post_id', 'user_id', name='uq_reaction_post_user')
    )
    op.create_index(op.f('ix_community_reactions_post_id'), 'community_reactions', ['post_id'], unique=False)
    op.create_index(op.f('ix_community_reactions_user_id'), 'community_reactions', ['user_id'], unique=False)
    op.create_table('community_comments',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('post_id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('text', sa.Text(), nullable=False),
    sa.Column('created_at', sa.DateTime(), nullable=True),
    sa.ForeignKeyConstraint(['post_id'], ['community_posts.id'], ),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_community_comments_post_id'), 'community_comments', ['post_id'], unique=False)
    op.create_index(op.f('ix_community_comments_user_id'), 'community_comments', ['user_id'], unique=False)
    _link('community_saves', 'uq_save_post_user')
    _link('community_shares', 'uq_share_post_user')


def downgrade() -> None:
    for t in ('community_shares', 'community_saves', 'community_comments', 'community_reactions',
              'community_post_images', 'community_posts', 'community_profiles'):
        op.drop_table(t)
