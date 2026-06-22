/**
 * Tests overlap RPC + concurrent create via Supabase client.
 * Usage:
 *   SUPABASE_TEST_EMAIL=... SUPABASE_TEST_PASSWORD=... node scripts/test-concurrency.mjs
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
    // .env optional if vars already exported
  }
}

loadEnv();

const url = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
const email = process.env.SUPABASE_TEST_EMAIL;
const password = process.env.SUPABASE_TEST_PASSWORD;

const TEST_ROOM = 'tochim2-13';
const TEST_CHECK_IN = '2099-08-01';
const TEST_CHECK_OUT = '2099-08-04';

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

async function main() {
  if (!url || !anonKey) {
    fail('config', 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, anonKey);

  if (!email || !password) {
    console.log('Skipping API tests (set SUPABASE_TEST_EMAIL + SUPABASE_TEST_PASSWORD in .env)');
    console.log('DB-level tests were run separately via Supabase MCP.');
    process.exit(0);
  }

  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (authError || !auth.session) {
    fail('sign in', authError?.message ?? 'No session');
    process.exit(1);
  }
  ok('sign in', email);

  const { data: overlapHit, error: rpcError } = await supabase.rpc(
    'find_reservation_room_overlap',
    {
      p_room_unit_id: 'nhamoc1-01',
      p_check_in: '2026-07-11',
      p_check_out: '2026-07-13',
      p_exclude_reservation_id: null,
    },
  );
  if (rpcError) {
    fail('RPC overlap (existing booking)', rpcError.message);
  } else if (overlapHit?.[0]?.guest_name === 'Thảo Nguyên') {
    ok('RPC overlap (existing booking)', 'found Thảo Nguyên');
  } else {
    fail('RPC overlap (existing booking)', JSON.stringify(overlapHit));
  }

  const { data: overlapMiss, error: rpcMissError } = await supabase.rpc(
    'find_reservation_room_overlap',
    {
      p_room_unit_id: TEST_ROOM,
      p_check_in: TEST_CHECK_IN,
      p_check_out: TEST_CHECK_OUT,
      p_exclude_reservation_id: null,
    },
  );
  if (rpcMissError) {
    fail('RPC no overlap (empty slot)', rpcMissError.message);
  } else if (!overlapMiss?.length) {
    ok('RPC no overlap (empty slot)');
  } else {
    fail('RPC no overlap (empty slot)', JSON.stringify(overlapMiss));
  }

  const makeInput = (guestName) => ({
    guest_name: guestName,
    guest_phone: '',
    guests: 1,
    notes: '__concurrency_test__',
    guest_color: '#336699',
  });

  const createWithRoom = async (guestName) => {
    const { data: reservation, error: insertError } = await supabase
      .from('reservations')
      .insert(makeInput(guestName))
      .select('id')
      .single();
    if (insertError) return { error: insertError, id: null };

    const { error: roomError } = await supabase.from('reservation_rooms').insert({
      reservation_id: reservation.id,
      room_unit_id: TEST_ROOM,
      check_in: TEST_CHECK_IN,
      check_out: TEST_CHECK_OUT,
    });
    if (roomError) {
      await supabase.from('reservations').delete().eq('id', reservation.id);
      return { error: roomError, id: null };
    }
    return { error: null, id: reservation.id };
  };

  const [first, second] = await Promise.all([
    createWithRoom('__concurrency_test_a__'),
    createWithRoom('__concurrency_test_b__'),
  ]);

  const createdIds = [first.id, second.id].filter(Boolean);
  const winners = createdIds.length;
  const losers = [first, second].filter((r) => r.error).length;

  if (winners === 1 && losers === 1) {
    ok('concurrent double-book', 'one succeeded, one blocked');
    const blocked = first.error ? first : second;
    if (blocked.error?.code === '23P01') {
      ok('concurrent block reason', 'exclusion constraint 23P01');
    } else {
      ok('concurrent block reason', blocked.error?.message ?? 'unknown');
    }
  } else {
    fail(
      'concurrent double-book',
      `winners=${winners} losers=${losers} errors=${JSON.stringify([first.error?.message, second.error?.message])}`,
    );
  }

  if (createdIds.length) {
    await supabase.from('reservations').delete().in('id', createdIds);
    ok('cleanup test reservations');
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
