import XLSX from 'xlsx';

const wb = XLSX.readFile('public/(2026_VA) thông tin khách.xlsx');
const ws = wb.Sheets['Bungalow'];
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
const headers = data[0].slice(2).map((h) => String(h).trim().replace(/\s+/g, ' '));

const dates = [];
for (let r = 1; r < data.length; r++) {
  const d = XLSX.SSF.parse_date_code(data[r][0]);
  if (d) dates.push(`${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`);
}
console.log('Date range:', dates[0], 'to', dates[dates.length - 1], '(' + dates.length + ' days)');

// Map Excel columns to app room types
const QUEEN_MAP = {
  '1g': { type: 'Nhà mộc 1 giường', roomTypeId: 2, prefix: 'nhamoc1' },
  '2g': { type: 'Tổ chim 2 giường', roomTypeId: 1, prefix: 'tochim2' },
  '3g': { type: 'Nhà mộc 3 giường', roomTypeId: 3, prefix: 'nhamoc3' },
};

const columnMap = headers.map((col, i) => {
  const m = col.match(/Queen\s+(\d+g)\s+(.+)/i);
  if (!m) return { col, index: i, error: 'unparsed' };
  const group = m[1].toLowerCase();
  const code = m[2];
  const info = QUEEN_MAP[group];
  return {
    excel: col,
    queenGroup: group,
    roomCode: code,
    appType: info?.type,
    suggestedUnitId: info ? `${info.prefix}-${String(i + 1).padStart(2, '0')}` : null,
  };
});

console.log('\nColumn mapping:');
columnMap.forEach((c) =>
  console.log(`${c.excel} → ${c.appType ?? '?'} (${c.suggestedUnitId ?? '?'})`),
);

// Count unique reservation-like blocks per column
function normalizeGuest(text) {
  const phone = text.match(/(?:0|\+84)\d[\d\s]{8,12}/)?.[0]?.replace(/\s/g, '') ?? '';
  const name =
    text.match(/Họ và tên:\s*([^\n-]+)/i)?.[1]?.trim() ||
    text.match(/Họ tên:\s*([^\n]+)/i)?.[1]?.trim() ||
    text.split('\n')[0].slice(0, 40);
  return { phone, name: name.slice(0, 60), rawLen: text.length };
}

let shortNotes = 0;
let longForms = 0;
for (let r = 1; r < data.length; r++) {
  for (let c = 2; c < data[0].length; c++) {
    const val = String(data[r][c] || '').trim();
    if (!val) continue;
    if (val.length > 80 || val.includes('Họ và tên')) longForms++;
    else shortNotes++;
  }
}
console.log('\nCell content style: short notes', shortNotes, '| long booking forms', longForms);
