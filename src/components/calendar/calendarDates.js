// Local-time day helpers shared by the calendars. A day string is YYYY-MM-DD in local time; weeks start on Sunday.
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

// The Sunday that starts the week holding `value`.
export function startOfWeek(value) {
  const date = startOfDay(value);
  date.setDate(date.getDate() - date.getDay());
  return date;
}

export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const sameDay = (left, right) => Boolean(left && right) && left.getTime() === right.getTime();

// The days of `month` in a six-week, Sunday-first grid. `before` and `after` are the neighbouring months' days that fill it,
// and `leading` is how many come before the 1st.
export function monthDays(month) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const leading = new Date(year, monthIndex, 1).getDay();
  const count = new Date(year, monthIndex + 1, 0).getDate();
  return {
    leading,
    days: Array.from({ length: count }, (_, index) => new Date(year, monthIndex, index + 1)),
    before: Array.from({ length: leading }, (_, index) => new Date(year, monthIndex, index - leading + 1)),
    after: Array.from({ length: 42 - leading - count }, (_, index) => new Date(year, monthIndex + 1, index + 1)),
  };
}
