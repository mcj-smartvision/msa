# Database Backup & Restore Guide (Supabase / Liparta)

This guide explains how to back up the current Supabase Postgres database and restore it into another database later.

---

## What the backup includes

- **Included:** database schema and data (tables, rows) in a `.sql` file
- **Not included:** Supabase Storage files (uploaded images, face photos, documents). Those must be migrated separately if needed.

Backup files are saved locally under:

```text
backups/backup-YYYY-MM-DDTHH-mm-ss.sql
```

Example:

```text
backups/backup-2026-08-07T07-43-00.sql
```

---

## 1) Take a backup (current project)

### Prerequisites

In `.env.local`, set a valid Postgres connection string:

```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```

If the password contains `@`, percent-encode it as `%40`.

Example:

- Password: `ssM@2408589`
- Encoded: `ssM%402408589`

For Windows / IPv6 issues, Session/Transaction pooler is recommended:

```env
DATABASE_POOLER_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:6543/postgres
```

Where to find the connection string in Supabase:

1. Open the project in Supabase
2. Click **Connect**
3. Open **Direct** (or Session / Transaction pooler)
4. Copy the `postgresql://...` URI

### Run backup

From the project root:

```bash
npm run backup
```

If successful, you will see a message like:

```text
✅ Backup saved (... MB):
   backups/backup-....sql
```

---

## 2) Restore into another database (future migration)

### Step A — Prepare the destination

1. Create a new Supabase project (or prepare another Postgres database)
2. Copy its Postgres connection URI
3. Keep the destination database password ready

### Step B — Import the SQL backup

Using `psql` on your machine:

```bash
psql "postgresql://postgres:[PASSWORD]@db.[NEW-PROJECT-REF].supabase.co:5432/postgres" -f backups/backup-YYYY-MM-DDTHH-mm-ss.sql
```

Or via pooler (often more reliable on Windows):

```bash
psql "postgresql://postgres.[NEW-PROJECT-REF]:[PASSWORD]@aws-1-ca-central-1.pooler.supabase.com:6543/postgres" -f backups/backup-YYYY-MM-DDTHH-mm-ss.sql
```

Notes:

- Replace `[PASSWORD]` and project ref with destination values
- Percent-encode special characters in the password (`@` → `%40`)
- Use a PostgreSQL client version close to the server version when possible (this project uses Postgres 17 on Supabase)

### Step C — Point the app to the new project

Update `.env.local` for the application:

```env
NEXT_PUBLIC_SUPABASE_URL=https://[NEW-PROJECT-REF].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgresql://...
```

Then redeploy / restart the app.

---

## 3) Quick reference

| Task | Command / action |
|------|------------------|
| Create backup | `npm run backup` |
| Restore to new DB | `psql "NEW_DATABASE_URL" -f backups/backup-....sql` |
| App connection keys | Supabase → Connect → Framework |
| DB connection string | Supabase → Connect → Direct / Pooler |

---

## 4) Checklist before going live on a new database

- [ ] SQL restore completed without critical errors
- [ ] App env vars updated to the new Supabase project
- [ ] Login / auth works
- [ ] Core tables have data (members, projects, attendance, etc.)
- [ ] Storage buckets/files migrated if the product needs uploaded media
- [ ] Old credentials rotated if they were shared or exposed

---

## Security note

Never commit `.env.local` or database passwords to Git.  
Backup files in `backups/` may contain sensitive production data — keep them private.
