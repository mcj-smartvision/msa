from __future__ import annotations

import os
import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool, text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.qc_engine.models import QcEngineBase  # noqa: E402

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = QcEngineBase.metadata


def get_database_url() -> str | None:
    return (
        os.getenv("QC_ENGINE_DATABASE_URL")
        or os.getenv("QC_ENGINE_TEST_DATABASE_URL")
        or None
    )


def run_migrations_offline() -> None:
    url = get_database_url()
    if not url:
        raise RuntimeError(
            "No local/test database configured. Set QC_ENGINE_DATABASE_URL."
        )
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        include_schemas=True,
        version_table="alembic_version",
        version_table_schema="qc_engine",
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    url = get_database_url()
    if not url:
        raise RuntimeError(
            "No local/test database configured. Set QC_ENGINE_DATABASE_URL."
        )

    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = url
    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        connection.execute(text("CREATE SCHEMA IF NOT EXISTS qc_engine"))
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_schemas=True,
            version_table="alembic_version",
            version_table_schema="qc_engine",
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
