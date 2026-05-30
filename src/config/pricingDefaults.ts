/** Default: Fri, Sat, Sun use weekend rate. */
export const DEFAULT_WEEKEND_DAYS: number[] = [5, 6, 0];

export const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export const DAY_OPTIONS = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
] as const;
