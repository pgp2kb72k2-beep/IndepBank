import { describe, expect, it } from "vitest";
import { addDays, daysBetween, monthStart, toDayNumber, todayIn } from "./dates";

describe("dates", () => {
  it("rejects malformed and impossible dates", () => {
    expect(() => toDayNumber("18/11/2026")).toThrow(/format/);
    expect(() => toDayNumber("2026-02-30")).toThrow(/Invalid date: 2026-02-30/);
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-11-01", 30)).toBe("2026-12-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("counts days between dates", () => {
    expect(daysBetween("2026-11-20", "2026-11-30")).toBe(10);
    expect(daysBetween("2026-11-23", "2026-11-22")).toBe(-1);
  });

  it("returns the first day of the month", () => {
    expect(monthStart("2026-11-20")).toBe("2026-11-01");
  });

  it("computes today in America/Montevideo, not UTC", () => {
    // 02:00 UTC on the 14th is still 23:00 on the 13th in Montevideo (UTC−3).
    expect(todayIn(undefined, new Date("2026-11-14T02:00:00Z"))).toBe("2026-11-13");
    expect(todayIn("UTC", new Date("2026-11-14T02:00:00Z"))).toBe("2026-11-14");
  });
});
