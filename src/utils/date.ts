/** Format as dd/mm/yyyy (e.g. 30/05/2026). */
export function formatDdMmYyyy(date: Date): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

export function todayDdMmYyyy(): string {
  return formatDdMmYyyy(new Date());
}

/** For &lt;input type="date" /&gt; (value must be yyyy-mm-dd). */
export function toIsoDateString(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function todayIso(): string {
  return toIsoDateString(new Date());
}

function dateFromParts(day: number, month: number, year: number): Date | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Parse dd/mm/yyyy. Returns null if invalid. */
export function parseDdMmYyyy(value: string): Date | null {
  const trimmed = value.trim();
  const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    return dateFromParts(
      Number(slashMatch[1]),
      Number(slashMatch[2]),
      Number(slashMatch[3]),
    );
  }

  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 8) {
    return dateFromParts(
      Number(digits.slice(0, 2)),
      Number(digits.slice(2, 4)),
      Number(digits.slice(4, 8)),
    );
  }

  return null;
}

/** Auto-format digits as dd/mm/yyyy while typing. */
export function sanitizeDdMmYyyyInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
