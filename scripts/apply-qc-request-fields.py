"""Apply database/61-qc-request-fields.sql"""
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

sql = (root / "database" / "61-qc-request-fields.sql").read_text(encoding="utf-8")
stmts = [part.strip() for part in sql.split(";") if part.strip() and not part.strip().startswith("--")]

conn = None
last_error = None
for index, url in enumerate(urls):
    try:
        conn = psycopg2.connect(url)
        break
    except Exception as error:  # noqa: BLE001
        last_error = f"url[{index}]: {error}"
        conn = None
if conn is None:
    raise SystemExit(f"database connect failed: {last_error}")
conn.autocommit = True
cur = conn.cursor()
for stmt in stmts:
    cur.execute(stmt)
cur.execute(
    """
    select column_name
    from information_schema.columns
    where table_schema = 'qc_engine' and table_name = 'inspection_request'
    order by ordinal_position
    """
)
columns = [row[0] for row in cur.fetchall()]
cur.execute("select count(*) from qc_engine.inspection_request")
count = cur.fetchone()[0]
cur.close()
conn.close()
print("migration-61-ok")
print("columns", ",".join(columns))
print("request_count", count)
