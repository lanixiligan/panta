// Local-time day helpers shared by the calendars. A day string is YYYY-MM-DD in local time; weeks start on Monday.
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function toDayString(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseDay(value) {
  if (!value || !DAY_PATTERN.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isFinite(date.getTime()) ? date : null;
}

export const sameDay = (left, right) => Boolean(left && right) && left.getTime() === right.getTime();

// The days of `month`, plus how many blank cells come before the 1st in a Monday-first grid.
export function monthDays(month) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return { leading: (first.getDay() + 6) % 7, days: Array.from({ length: count }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1)) };
}
