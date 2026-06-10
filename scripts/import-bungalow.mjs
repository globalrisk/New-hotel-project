/**
 * Import Bungalow bookings from public/(2026_VA) thông tin khách.xlsx into Supabase.
 * Groups by Excel cell fill color + overlapping dates (same color + same stay = one reservation).
 * Display colors are assigned per reservation from the app palette — not copied from Excel.
 * Usage: node scripts/import-bungalow.mjs
 */
import fs from 'fs';
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const EXCEL_PATH = 'public/(2026_VA) thông tin khách.xlsx';
const SHEET = 'Bungalow';

const PALETTE = [
  '#c98a3d', '#4a90a4', '#6b8e4e', '#9b59b6', '#e74c3c', '#3498db', '#1abc9c',
  '#f39c12', '#8e44ad', '#2c3e50', '#d35400', '#27ae60', '#2980b9', '#c0392b',
  '#16a085', '#7f8c8d', '#e67e22', '#a569bd',
];

/** Excel column label → unit id (must match src/data/roomUnits.ts). */
const LABEL_TO_UNIT = {
  'Queen 1g SUN': 'nhamoc1-01',
  'Queen 1g 003': 'nhamoc1-02',
  'Queen 2g 101': 'tochim2-01',
  'Queen 2g 102': 'tochim2-02',
  'Queen 2g 103': 'tochim2-03',
  'Queen 2g 104': 'tochim2-04',
  'Queen 2g 105': 'tochim2-05',
  'Queen 2g 106': 'tochim2-06',
  'Queen 2g 107': 'tochim2-07',
  'Queen 2g 108': 'tochim2-08',
  'Queen 2g 109': 'tochim2-09',
  'Queen 2g 110': 'tochim2-10',
  'Queen 2g 111': 'tochim2-11',
  'Queen 2g 112': 'tochim2-12',
  'Queen 2g 115': 'tochim2-13',
  'Queen 3g 001': 'nhamoc3-01',
  'Queen 3g 002': 'nhamoc3-02',
  'Queen 3g QUEEN': 'nhamoc3-03',
};

function loadEnv() {
  const raw = fs.readFileSync('.env', 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function normalizeHeader(h) {
  return String(h).trim().replace(/\s+/g, ' ');
}

function getCellFill(ws, row, col) {
  const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
  const rgb = cell?.s?.fgColor?.rgb ?? cell?.s?.bgColor?.rgb;
  if (!rgb) return null;
  return `#${rgb.slice(-6).toUpperCase()}`;
}

function parsePhone(text) {
  const m = text.match(/(?:\+84|0)\s*[\d\s]{8,12}/);
  if (!m) return '';
  return m[0].replace(/\s/g, '').replace(/^\+84/, '0');
}

function parseName(text) {
  const patterns = [
    /Họ và tên:\s*([^\n-]+)/i,
    /Họ tên:\s*([^\n]+)/i,
    /- Họ và tên:\s*([^\n]+)/i,
    /^(?:Anh|Chị|Cô)\s+([A-Za-zÀ-ỹ][A-Za-zÀ-ỹ\s]{1,40}?)\s+(?:0|\+84)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]?.trim()) {
      return m[1].trim().replace(/\s+/g, ' ');
    }
  }
  const first = text.split('\n')[0].trim();
  const cleaned = first
    .replace(/^Khách của\s+\S+\s*-?\s*/i, '')
    .replace(/^-+\s*/, '')
    .trim();
  if (cleaned.length >= 2 && cleaned.length <= 60) return cleaned;
  return '';
}

function parseGuests(text) {
  const m = text.match(/Số khách\s*[:：]?\s*([^\n]+)/i);
  if (!m) return 1;
  const nums = m[1].match(/\d+/);
  return nums ? Math.max(1, parseInt(nums[0], 10)) : 1;
}

function parseGuestCell(text) {
  const raw = text.trim();
  const phone = parsePhone(raw);
  let name = parseName(raw);
  if (!name && phone) name = phone;
  if (!name) {
    name = raw.replace(/\n/g, ' ').slice(0, 48).trim();
  }
  const guests = parseGuests(raw);
  const key = phone ? `p:${phone}` : `n:${name.toLowerCase()}`;
  return { name, phone, guests, notes: raw, key };
}

function isoFromSerial(serial) {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d || d.y < 2020) return null;
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function rangesOverlap(aIn, aOut, bIn, bOut) {
  return aIn < bOut && bIn < aOut;
}

function emptyGuest(fillColor) {
  return {
    name: '',
    phone: '',
    guests: 1,
    notes: '',
    key: fillColor ? `c:${fillColor.toLowerCase()}` : 'empty',
  };
}

function siblingHasTextWithFill(data, ws, row, fillColor, skipCol) {
  for (let c = 2; c < data[0].length; c++) {
    if (c === skipCol) continue;
    const text = String(data[row]?.[c] ?? '').trim();
    if (!text) continue;
    if (getCellFill(ws, row, c) === fillColor) return true;
  }
  return false;
}

function startFillOnlyStay(ws, data, row, colIndex, unitId, iso, fillColor) {
  let startRow = row;
  while (startRow > 1) {
    const prevRaw = String(data[startRow - 1]?.[colIndex] ?? '').trim();
    const prevFill = getCellFill(ws, startRow - 1, colIndex);
    if (!prevRaw && prevFill === fillColor) startRow--;
    else break;
  }
  const checkIn = isoFromSerial(data[startRow][0]) ?? iso;
  return {
    roomUnitId: unitId,
    checkIn,
    checkOut: addDays(iso, 1),
    raw: '',
    fillColor,
    guest: emptyGuest(fillColor),
    groupKey: `c:${fillColor.toLowerCase()}`,
  };
}

function buildStays(ws, data, colIndex, unitId) {
  const stays = [];
  let current = null;

  for (let r = 1; r < data.length; r++) {
    const iso = isoFromSerial(data[r][0]);
    if (!iso) continue;
    const raw = String(data[r][colIndex] ?? '').trim();
    const fillColor = getCellFill(ws, r, colIndex);

    if (!raw) {
      if (current && fillColor && current.fillColor === fillColor) {
        current.checkOut = addDays(iso, 1);
        continue;
      }
      if (
        !current &&
        fillColor &&
        siblingHasTextWithFill(data, ws, r, fillColor, colIndex)
      ) {
        current = startFillOnlyStay(ws, data, r, colIndex, unitId, iso, fillColor);
        continue;
      }
      if (current) {
        stays.push(current);
        current = null;
      }
      continue;
    }

    if (current && !current.raw && fillColor && current.fillColor === fillColor) {
      current.raw = raw;
      current.guest = parseGuestCell(raw);
      current.checkOut = addDays(iso, 1);
      continue;
    }

    const sameSegment =
      current &&
      current.raw === raw &&
      current.fillColor === fillColor;

    if (sameSegment) {
      current.checkOut = addDays(iso, 1);
      current.guest = parseGuestCell(raw);
    } else {
      if (current) stays.push(current);
      current = {
        roomUnitId: unitId,
        checkIn: iso,
        checkOut: addDays(iso, 1),
        raw,
        fillColor,
        guest: parseGuestCell(raw),
        groupKey: fillColor ? `c:${fillColor.toLowerCase()}` : `g:${parseGuestCell(raw).key}`,
      };
    }
  }
  if (current) stays.push(current);
  return stays;
}

/** Same room may appear as multiple segments — merge date ranges. */
function mergeRooms(rooms) {
  const byUnit = new Map();
  for (const stay of rooms) {
    const prev = byUnit.get(stay.roomUnitId);
    if (!prev) {
      byUnit.set(stay.roomUnitId, { ...stay });
      continue;
    }
    if (stay.checkIn < prev.checkIn) prev.checkIn = stay.checkIn;
    if (stay.checkOut > prev.checkOut) prev.checkOut = stay.checkOut;
  }
  return [...byUnit.values()];
}

/** Union-find: same groupKey + overlapping dates → one reservation. */
function groupStaysIntoReservations(stays) {
  const parent = stays.map((_, i) => i);
  const find = (i) => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const unite = (i, j) => {
    const a = find(i);
    const b = find(j);
    if (a !== b) parent[b] = a;
  };

  for (let i = 0; i < stays.length; i++) {
    for (let j = i + 1; j < stays.length; j++) {
      if (stays[i].groupKey !== stays[j].groupKey) continue;
      if (
        rangesOverlap(
          stays[i].checkIn,
          stays[i].checkOut,
          stays[j].checkIn,
          stays[j].checkOut,
        )
      ) {
        unite(i, j);
      }
    }
  }

  const buckets = new Map();
  for (let i = 0; i < stays.length; i++) {
    const root = find(i);
    if (!buckets.has(root)) buckets.set(root, []);
    buckets.get(root).push(stays[i]);
  }

  return [...buckets.values()].map((list) => {
    let guestName = '';
    let guestPhone = '';
    let guests = 1;
    let notes = '';
    for (const stay of list) {
      const g = stay.guest;
      if (g.notes.length > notes.length) notes = g.notes;
      if (g.guests > guests) guests = g.guests;
      if (g.name.length > guestName.length) guestName = g.name;
      if (g.phone && !guestPhone) guestPhone = g.phone;
    }

    return {
      guestName,
      guestPhone,
      guests,
      notes,
      rooms: mergeRooms(
        list.map((s) => ({
          roomUnitId: s.roomUnitId,
          checkIn: s.checkIn,
          checkOut: s.checkOut,
        })),
      ),
    };
  });
}

function suggestColor(used, index) {
  const available = PALETTE.find((c) => !used.has(c.toLowerCase()));
  if (available) return available;
  const hue = (index * 47) % 360;
  return `hsl(${hue}, 55%, 42%)`;
}

async function main() {
  const env = loadEnv();
  const url = env.VITE_SUPABASE_URL;
  const key = env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const wb = XLSX.readFile(EXCEL_PATH, { cellStyles: true });
  const ws = wb.Sheets[SHEET];
  if (!ws) {
    console.error('Sheet not found:', SHEET);
    process.exit(1);
  }

  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  const headers = data[0];

  const columnUnits = [];
  for (let c = 2; c < headers.length; c++) {
    const label = normalizeHeader(headers[c]);
    const unitId = LABEL_TO_UNIT[label];
    if (!unitId) {
      console.warn('Skipping unmapped column:', label);
      continue;
    }
    columnUnits.push({ colIndex: c, label, unitId });
  }

  console.log('Mapped', columnUnits.length, 'room columns');

  const allStays = [];
  for (const col of columnUnits) {
    allStays.push(...buildStays(ws, data, col.colIndex, col.unitId));
  }
  console.log('Parsed', allStays.length, 'room stays from Excel');

  const colorStays = allStays.filter((s) => s.fillColor);
  const plainStays = allStays.filter((s) => !s.fillColor);
  console.log('With Excel color:', colorStays.length, '| No fill:', plainStays.length);

  const reservations = [
    ...groupStaysIntoReservations(colorStays),
    ...groupStaysIntoReservations(plainStays),
  ];
  console.log('Grouped into', reservations.length, 'reservations (color + date overlap)');

  const { error: delErr } = await supabase
    .from('reservations')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) {
    console.error('Failed to clear existing reservations:', delErr.message);
    process.exit(1);
  }
  console.log('Cleared existing reservations');

  const usedColors = new Set();
  let imported = 0;

  for (let i = 0; i < reservations.length; i++) {
    const r = reservations[i];
    const guestColor = suggestColor(usedColors, i);
    usedColors.add(guestColor.toLowerCase());

    const { data: row, error: insErr } = await supabase
      .from('reservations')
      .insert({
        guest_name: r.guestName,
        guest_phone: r.guestPhone,
        guests: r.guests,
        notes: r.notes,
        guest_color: guestColor,
      })
      .select('id')
      .single();

    if (insErr) {
      console.error('Insert failed:', r.guestName, insErr.message);
      continue;
    }

    const { error: roomErr } = await supabase.from('reservation_rooms').insert(
      r.rooms.map((stay) => ({
        reservation_id: row.id,
        room_unit_id: stay.roomUnitId,
        check_in: stay.checkIn,
        check_out: stay.checkOut,
      })),
    );

    if (roomErr) {
      console.error('Rooms insert failed:', r.guestName, roomErr.message);
      await supabase.from('reservations').delete().eq('id', row.id);
      continue;
    }

    imported++;
  }

  console.log('Imported', imported, '/', reservations.length, 'reservations into Supabase');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
