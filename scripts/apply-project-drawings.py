"""Apply database/58-project-drawings.sql"""
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

sql = (root / "database" / "58-project-drawings.sql").read_text(encoding="utf-8")
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
cur.execute("select to_regclass('public.project_drawings')")
table = cur.fetchone()[0]
cur.execute("select id from storage.buckets where id = %s", ("project-drawings",))
bucket = cur.fetchone()
cur.close()
conn.close()
print("migration-58-ok")
print("table", bool(table))
print("bucket", bool(bucket))
