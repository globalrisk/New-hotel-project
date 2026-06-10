import XLSX from 'xlsx';

const wb = XLSX.readFile('public/(2026_VA) thông tin khách.xlsx');
const ws = wb.Sheets['Bungalow'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const headers = data[0];

let filled = 0;
const samples = [];
const byRoom = new Map();

for (let r = 1; r < data.length; r++) {
  const row = data[r];
  const dateSerial = row[0];
  const d = XLSX.SSF.parse_date_code(dateSerial);
  const iso = d
    ? `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
    : String(dateSerial);

  for (let c = 2; c < headers.length; c++) {
    const val = String(row[c] || '').trim();
    if (!val) continue;
    filled++;
    const room = String(headers[c]).trim();
    byRoom.set(room, (byRoom.get(room) ?? 0) + 1);
    if (samples.length < 40) {
      samples.push({ date: iso, day: row[1], room, guest: val });
    }
  }
}

console.log('Total booked cells:', filled);
console.log('\nRoom columns (' + (headers.length - 2) + '):');
headers.slice(2).forEach((h, i) => console.log(' ', i, JSON.stringify(String(h).trim())));

console.log('\nBookings per room column:');
[...byRoom.entries()].sort((a, b) => b[1] - a[1]).forEach(([room, n]) => console.log(n, room));

console.log('\nSample entries:');
samples.forEach((s) => console.log(JSON.stringify(s)));

// Detect multi-night stays (same guest same room consecutive dates)
const entries = [];
for (let r = 1; r < data.length; r++) {
  const row = data[r];
  const d = XLSX.SSF.parse_date_code(row[0]);
  if (!d) continue;
  const iso = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  for (let c = 2; c < headers.length; c++) {
    const val = String(row[c] || '').trim();
    if (val) entries.push({ iso, room: String(headers[c]).trim(), guest: val });
  }
}
entries.sort((a, b) => a.room.localeCompare(b.room) || a.iso.localeCompare(b.iso));

let streaks = 0;
for (let i = 0; i < entries.length; i++) {
  const e = entries[i];
  const prev = entries[i - 1];
  if (prev && prev.room === e.room && prev.guest === e.guest) {
    const prevD = new Date(prev.iso);
    const curD = new Date(e.iso);
    const diff = (curD - prevD) / 86400000;
    if (diff === 1) streaks++;
  }
}
console.log('\nConsecutive same-guest-same-room nights:', streaks);
