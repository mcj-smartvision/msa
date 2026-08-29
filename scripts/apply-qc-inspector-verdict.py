"""Apply database/62-qc-inspector-verdict.sql"""
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

sql = (root / "database" / "62-qc-inspector-verdict.sql").read_text(encoding="utf-8")
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
      and column_name in ('inspector_notes','inspector_classified','inspector_verdict')
    order by column_name
    """
)
columns = [row[0] for row in cur.fetchall()]
cur.close()
conn.close()
print("migration-62-ok")
print("inspector_columns", ",".join(columns))
