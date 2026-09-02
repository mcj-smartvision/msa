"""Apply database/65-project-schedules-storage.sql"""
from __future__ import annotations

import pathlib
import re

import psycopg2

root = pathlib.Path(__file__).resolve().parents[1]
env = (root / ".env.local").read_text(encoding="utf-8")


def env_value(name: str) -> str | None:
    match = re.search(rf"^{re.escape(name)}=(.+)$", env, re.M)
    if not match:
        return None
    return match.group(1).strip().strip("\"'")


urls = [value for value in (env_value("DATABASE_POOLER_URL"), env_value("DATABASE_URL")) if value]
if not urls:
    raise SystemExit("DATABASE_URL missing")

sql = (root / "database" / "65-project-schedules-storage.sql").read_text(encoding="utf-8")
lines = [line for line in sql.splitlines() if not line.strip().startswith("--")]
stmts = [part.strip() for part in "\n".join(lines).split(";") if part.strip()]

conn = None
last_error = None
for url in urls:
    try:
        conn = psycopg2.connect(url)
        break
    except Exception as error:  # noqa: BLE001
        last_error = error
        conn = None
if conn is None:
    raise SystemExit(f"database connect failed: {last_error}")
conn.autocommit = True
cur = conn.cursor()
for stmt in stmts:
    cur.execute(stmt)
cur.execute(
    "select column_name from information_schema.columns "
    "where table_schema='public' and table_name='schedule_imports' and column_name='storage_path'"
)
col = cur.fetchone()
cur.execute("select id from storage.buckets where id = %s", ("project-schedules",))
bucket = cur.fetchone()
cur.close()
conn.close()
print("migration-65-ok")
print("storage_path_column", bool(col))
print("bucket", bool(bucket))
