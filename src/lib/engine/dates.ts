import type { IsoDate } from "./types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Days since the Unix epoch. Throws on malformed or impossible dates (e.g. 2026-02-30). */
export function toDayNumber(date: IsoDate): number {
  if (!ISO_DATE.test(date)) throw new Error(`Invalid date format: ${date}`);
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const ms = Date.UTC(y, m - 1, d);
  if (new Date(ms).toISOString().slice(0, 10) !== date) throw new Error(`Invalid date: ${date}`);
  return ms / MS_PER_DAY;
}

export function assertIsoDate(date: IsoDate): void {
  toDayNumber(date);
}

export function addDays(date: IsoDate, days: number): IsoDate {
  return new Date((toDayNumber(date) + days) * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return toDayNumber(to) - toDayNumber(from);
}

export function monthStart(date: IsoDate): IsoDate {
  assertIsoDate(date);
  return `${date.slice(0, 8)}01`;
}

/** Today's calendar date in the given time zone (default: America/Montevideo). */
export function todayIn(timeZone = "America/Montevideo", now: Date = new Date()): IsoDate {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
