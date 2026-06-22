/**
 * Tests optimistic locking when two users edit the same booking.
 * Loads SUPABASE_TEST_EMAIL / SUPABASE_TEST_PASSWORD from .env
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env');
  try {
    const raw = readFileSync(envPath, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // optional
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.SUPABASE_TEST_EMAIL;
const password = process.env.SUPABASE_TEST_PASSWORD;

const TEST_ROOM = 'tochim2-13';
const TEST_CHECK_IN = '2099-10-01';
const TEST_CHECK_OUT = '2099-10-03';

let passed = 0;
let failed = 0;

function ok(name, detail = '') {
  passed += 1;
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ''}`);
}

function fail(name, detail = '') {
  failed += 1;
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ''}`);
}

async function updateWithBaseline(supabase, id, guestName, expectedUpdatedAt) {
  let query = supabase
    .from('reservations')
    .update({
      guest_name: guestName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (expectedUpdatedAt) {
    query = query.eq('updated_at', expectedUpdatedAt);
  }

  return query.select('id, guest_name, updated_at').maybeSingle();
}

async function main() {
  if (!url || !anonKey) {
    fail('config', 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }
  if (!email || !password) {
    fail('config', 'Missing SUPABASE_TEST_EMAIL or SUPABASE_TEST_PASSWORD in .env');
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);
  const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
  if (authError) {
    fail('sign in', authError.message);
    process.exit(1);
  }
  ok('sign in', email);

  const { data: created, error: createError } = await supabase
    .from('reservations')
    .insert({
      guest_name: '__edit_conflict_test__',
      guest_phone: '',
      guests: 1,
      notes: '__edit_conflict_test__',
      guest_color: '#336699',
    })
    .select('id, updated_at')
    .single();

  if (createError || !created) {
    fail('create test booking', createError?.message ?? 'no row');
    process.exit(1);
  }

  const reservationId = created.id;
  const { error: roomError } = await supabase.from('reservation_rooms').insert({
    reservation_id: reservationId,
    room_unit_id: TEST_ROOM,
    check_in: TEST_CHECK_IN,
    check_out: TEST_CHECK_OUT,
  });
  if (roomError) {
    await supabase.from('reservations').delete().eq('id', reservationId);
    fail('attach test room', roomError.message);
    process.exit(1);
  }
  ok('create test booking', reservationId);

  const baselineUpdatedAt = created.updated_at;
  if (!baselineUpdatedAt) {
    fail('baseline updated_at', 'missing on new row');
    process.exit(1);
  }
  ok('capture edit baseline', baselineUpdatedAt);

  const { data: userA, error: userAError } = await updateWithBaseline(
    supabase,
    reservationId,
    '__edit_conflict_user_a__',
    baselineUpdatedAt,
  );
  if (userAError || !userA) {
    await supabase.from('reservations').delete().eq('id', reservationId);
    fail('user A save (first editor)', userAError?.message ?? 'no row returned');
    process.exit(1);
  }
  ok('user A save (first editor)', userA.guest_name);

  const { data: userB, error: userBError } = await updateWithBaseline(
    supabase,
    reservationId,
    '__edit_conflict_user_b__',
    baselineUpdatedAt,
  );
  if (userBError) {
    await supabase.from('reservations').delete().eq('id', reservationId);
    fail('user B stale save', userBError.message);
    process.exit(1);
  }
  if (!userB) {
    ok('user B stale save blocked', '0 rows updated (optimistic lock)');
  } else {
    fail('user B stale save', `unexpected success: ${userB.guest_name}`);
  }

  const { data: latest, error: latestError } = await supabase
    .from('reservations')
    .select('guest_name, updated_at')
    .eq('id', reservationId)
    .single();
  if (latestError || !latest) {
    fail('verify winner', latestError?.message ?? 'missing row');
  } else if (latest.guest_name === '__edit_conflict_user_a__') {
    ok('verify winner', 'user A changes kept');
  } else {
    fail('verify winner', `guest_name=${latest.guest_name}`);
  }

  const { data: userBRetry, error: userBRetryError } = await updateWithBaseline(
    supabase,
    reservationId,
    '__edit_conflict_user_b_retry__',
    latest?.updated_at,
  );
  if (userBRetryError || !userBRetry) {
    fail('user B save after reload', userBRetryError?.message ?? 'no row');
  } else {
    ok('user B save after reload', userBRetry.guest_name);
  }

  await supabase.from('reservations').delete().eq('id', reservationId);
  ok('cleanup test booking');

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
