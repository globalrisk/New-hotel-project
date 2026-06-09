export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Keeps only digits from a price input, e.g. "1.500.000" -> "1500000". */
export function parsePriceInput(value: string): string {
  return value.replace(/\D/g, '');
}

/** Formats raw digits with dot separators, e.g. "1500000" -> "1.500.000". */
export function formatPriceInput(value: string): string {
  const digits = parsePriceInput(value);
  if (!digits) return '';
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
