import XLSX from 'xlsx';

const wb = XLSX.readFile('public/(2026_VA) thông tin khách.xlsx', { cellStyles: true });
const ws = wb.Sheets['Bungalow'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const headers = data[0].slice(2).map((h) => String(h).trim().replace(/\s+/g, ' '));

function isoFromSerial(serial) {
  const d = XLSX.SSF.parse_date_code(serial);
  if (!d || d.y < 2020) return null;
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
}

/** xlsx library exposes fill on cell.s (style index) — also try cell metadata */
function getCellFill(cell) {
  if (!cell) return null;
  // Direct fill sometimes on cell when cellStyles: true
  if (cell.s?.fgColor?.rgb) return `#${cell.s.fgColor.rgb.slice(-6)}`;
  if (cell.s?.bgColor?.rgb) return `#${cell.s.bgColor.rgb.slice(-6)}`;
  if (typeof cell.s === 'object' && cell.s.fill?.fgColor?.rgb) {
    return `#${cell.s.fill.fgColor.rgb.slice(-6)}`;
  }
  return null;
}

const entries = [];
const colorStats = new Map();

for (let r = 1; r < data.length; r++) {
  const iso = isoFromSerial(data[r][0]);
  if (!iso) continue;
  for (let c = 2; c < headers.length; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = ws[addr];
    const text = String(cell?.v ?? '').trim();
    if (!text) continue;
    const fill = getCellFill(cell);
    const colorKey = fill ?? '(no fill / default)';
    colorStats.set(colorKey, (colorStats.get(colorKey) ?? 0) + 1);
    entries.push({
      iso,
      room: headers[c - 2],
      guest: text.slice(0, 60).replace(/\n/g, ' '),
      fill: colorKey,
    });
  }
}

console.log('Filled cells:', entries.length);
console.log('\nFill color counts:');
[...colorStats.entries()]
  .sort((a, b) => b[1] - a[1])
  .forEach(([color, n]) => console.log(n, color));

// Group by color + date: same color on same day across rooms = same group?
const byColorDate = new Map();
for (const e of entries) {
  const key = `${e.fill}|${e.iso}`;
  if (!byColorDate.has(key)) byColorDate.set(key, []);
  byColorDate.get(key).push(e);
}

const multiRoomSameColor = [...byColorDate.entries()].filter(([, list]) => {
  const rooms = new Set(list.map((x) => x.room));
  return rooms.size > 1;
});

console.log('\nSame color + same day across multiple rooms:', multiRoomSameColor.length, 'instances');
multiRoomSameColor.slice(0, 8).forEach(([key, list]) => {
  console.log('\n---', key, '---');
  list.forEach((x) => console.log(' ', x.room, '|', x.guest));
});

// Sample raw cell objects for first filled cell
for (let r = 1; r < data.length; r++) {
  for (let c = 2; c < headers.length; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c })];
    if (cell?.v) {
      console.log('\nSample cell keys:', Object.keys(cell));
      console.log('Sample cell.s:', JSON.stringify(cell.s)?.slice(0, 500));
      process.exit(0);
    }
  }
}
