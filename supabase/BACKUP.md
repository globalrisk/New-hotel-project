# Supabase database backup (Free plan)

Supabase Free has **no Dashboard backups**. This project uses **daily GitHub Actions** (`pg_dump`) plus optional local dumps before big changes.

Project ref: `vuylwmliuoipwmlpsmty`

## One-time setup: `SUPABASE_DB_URL`

### 1. Get the database password

1. Open [Supabase Dashboard → Project Settings → Database](https://supabase.com/dashboard/project/vuylwmliuoipwmlpsmty/settings/database).
2. Note or reset the **database password** (not the anon/service API keys).

### 2. Copy the Session pooler URI

Use the **Session pooler** connection string (IPv4-friendly for GitHub Actions runners):

```text
postgresql://postgres.vuylwmliuoipwmlpsmty:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
```

Replace `[PASSWORD]` with your database password and `[region]` with your project region from the Dashboard.

### 3. Add GitHub repository secret

In GitHub: **Settings → Secrets and variables → Actions → New repository secret**

| Name | Value |
|------|--------|
| `SUPABASE_DB_URL` | Full connection URI above (includes password) |

Never commit this string to the repo. Keep the repository **private** — backups contain guest names and phone numbers.

If the secret is ever exposed, reset the database password in Supabase and update the GitHub secret.

## What gets backed up

Each run produces two gzip files:

| File | Contents |
|------|----------|
| `backup-public-YYYYMMDD.sql.gz` | Full `public` schema (tables, RLS, and row data) |
| `backup-auth-users-YYYYMMDD.sql.gz` | `auth.users` rows only (login accounts) |

Schema scripts in this folder (`*.sql`) remain the source of truth for **how** to set up a fresh project. Backups are point-in-time **snapshots** of the live database.

## Automated daily backup

Workflow: [`.github/workflows/backup-database.yml`](../.github/workflows/backup-database.yml)

- **Schedule:** every day at 03:00 UTC
- **Retention:** GitHub Actions artifacts kept for **90 days**
- **Side effect:** daily DB connection helps prevent Free-tier **project auto-pause** after inactivity

### Manual trigger (GitHub)

1. Open the repo on GitHub → **Actions**
2. Select **Backup database**
3. Click **Run workflow** → **Run workflow**
4. When finished, open the run → **Artifacts** → download `supabase-backup-YYYYMMDD`

Run manually before risky schema changes or bulk data edits.

## Local backup (optional)

Requires [PostgreSQL 17 client tools](https://www.postgresql.org/download/) (`pg_dump` on your PATH). Supabase runs Postgres 17 — older `pg_dump` versions fail with a version mismatch error.

```bash
# PowerShell
$env:SUPABASE_DB_URL = "postgresql://postgres.vuylwmliuoipwmlpsmty:..."
npm run backup:db
```

```bash
# macOS / Linux
SUPABASE_DB_URL="postgresql://..." npm run backup:db
```

Output goes to `backups/` (gitignored). Same format as the GitHub Actions workflow.

## Restore outline

**Warning:** restore can overwrite or duplicate data. Always test on a **copy** first (second free Supabase project).

1. Download the artifact from GitHub Actions (or use a local `.sql.gz` from `backups/`).
2. Decompress:
   ```bash
   gunzip backup-public-YYYYMMDD.sql.gz
   gunzip backup-auth-users-YYYYMMDD.sql.gz
   ```
3. **Best case:** restore into an **empty** Supabase project (new Free project).
   - Run the SQL files in **Supabase SQL Editor** in order, or use `psql` with your connection string.
   - Apply [`supabase/*.sql`](.) first if the target is brand new, then restore the backup — or use a full `public` dump alone if it includes `CREATE TABLE` from backup day.
4. For `auth.users`, run the auth dump **after** the auth schema exists (Supabase creates it by default).

### Schema changed since backup?

- Restoring an **old** backup onto a **new** schema often fails or misaligns columns.
- Prefer restoring to an **empty** project, or match the backup date’s structure.
- For structure history, use Git (`supabase/*.sql`), not old data dumps.

## Free plan notes

- **No native backups** on Free — this workflow is your safety net.
- **Pro ($25/mo)** adds 7-day Dashboard backups with easier restore.
- **Artifact limits:** ~90 daily snapshots at 90-day retention. For a small hotel DB this is usually enough. If storage limits are hit, reduce retention in the workflow or copy artifacts to external storage (S3, R2, Drive).

## Security checklist

- `SUPABASE_DB_URL` only in GitHub Secrets (and local env when running `backup:db`)
- Private GitHub repo if backups contain guest PII
- Rotate DB password if the secret leaks

## Verify after setup

1. Add `SUPABASE_DB_URL` secret in GitHub.
2. Run **Backup database** manually via Actions.
3. Confirm the artifact contains non-empty `.sql.gz` files.
4. Decompress and check for `COPY reservations` or `INSERT` lines.
5. (Optional) Restore into a second free Supabase project to validate.
