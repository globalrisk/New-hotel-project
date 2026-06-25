/**
 * Dump Supabase Postgres to local files (same as GitHub Actions backup workflow).
 * Requires pg_dump on PATH and SUPABASE_DB_URL in the environment.
 *
 * Usage:
 *   SUPABASE_DB_URL="postgresql://..." npm run backup:db
 */
import { execSync } from 'node:child_process';
import { createReadStream, createWriteStream, mkdirSync, unlinkSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import { join } from 'node:path';

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error('Missing SUPABASE_DB_URL. See supabase/BACKUP.md for setup.');
  process.exit(1);
}

async function gzipFile(inputPath, outputPath) {
  await pipeline(
    createReadStream(inputPath),
    createGzip({ level: 9 }),
    createWriteStream(outputPath),
  );
}

const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
const outDir = join(process.cwd(), 'backups');
mkdirSync(outDir, { recursive: true });

const publicSql = join(outDir, `backup-public-${date}.sql`);
const authSql = join(outDir, `backup-auth-users-${date}.sql`);

console.log('Dumping public schema...');
execSync(
  `pg_dump "${url}" --schema=public --no-owner --no-acl --format=plain -f "${publicSql}"`,
  { stdio: 'inherit', shell: true },
);

console.log('Dumping auth.users...');
execSync(
  `pg_dump "${url}" --schema=auth --table=auth.users --data-only --no-owner --no-acl --format=plain -f "${authSql}"`,
  { stdio: 'inherit', shell: true },
);

console.log('Compressing...');
await gzipFile(publicSql, `${publicSql}.gz`);
await gzipFile(authSql, `${authSql}.gz`);
unlinkSync(publicSql);
unlinkSync(authSql);

console.log(`Done: ${publicSql}.gz`);
console.log(`Done: ${authSql}.gz`);
