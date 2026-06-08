import { describe, expect, it } from "vitest";
import { parseClockifyDetailedCsv } from "./clockifyImport";

function date(year, month, day) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function segment(startYear, startMonth, startDay, endYear, endMonth, endDay) {
  return {
    startDate: date(startYear, startMonth, startDay),
    endDate: date(endYear, endMonth, endDay),
  };
}

describe("parseClockifyDetailedCsv", () => {
  it("groups entries by invoice week before rounding to 15-minute increments", () => {
    const csv = [
      "Start Date,Duration (h)",
      "2026-05-01,0:04:00",
      "2026-05-02,0:04:00",
      "2026-05-04,1:07:00",
    ].join("\n");

    const result = parseClockifyDetailedCsv(csv, [
      segment(2026, 5, 1, 2026, 5, 3),
      segment(2026, 5, 4, 2026, 5, 10),
    ]);

    expect(result.ok).toBe(true);
    expect(result.totals).toEqual([0.25, 1]);
    expect(result.rawTotalHours).toBe(1.25);
    expect(result.totalHours).toBe(1.25);
  });

  it("rejects summary-style exports that do not include entry dates", () => {
    const csv = ["Project,Duration (h)", "Client work,4:30:00"].join("\n");

    const result = parseClockifyDetailedCsv(csv, [segment(2026, 5, 1, 2026, 5, 31)]);

    expect(result.ok).toBe(false);
    expect(result.message).toMatch(/Summary export detected/);
  });

  it("reports a detected month when detailed entries are outside the selected period", () => {
    const csv = ["Start Date,Duration (h)", "2026-06-03,2:00:00"].join("\n");

    const result = parseClockifyDetailedCsv(csv, [segment(2026, 5, 1, 2026, 5, 31)]);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("period_mismatch");
    expect(result.detectedMonth).toBe("2026-06");
  });

  it("parses ambiguous slash dates by matching the selected invoice period", () => {
    const csv = ["Start Date,Duration (h)", "07/05/2026,1:00:00"].join("\n");

    const result = parseClockifyDetailedCsv(csv, [segment(2026, 5, 1, 2026, 5, 31)], {
      fileName: "demo-clockify-report-may-2026.csv",
    });

    expect(result.ok).toBe(true);
    expect(result.totals).toEqual([1]);
  });

  it("handles a six-week invoice month with quoted Clockify rows", () => {
    const csv = [
      "Project,Task,Start Date,Duration (h)",
      '"Retainer, Core","Planning",2026-08-01,0:16:00',
      '"Retainer, Core","Build",2026-08-03,1:22:00',
      '"Retainer, Core","QA",2026-08-10,2:37:00',
      '"Retainer, Core","Support",2026-08-17,3:52:00',
      '"Retainer, Core","Review",2026-08-24,4:07:00',
      '"Retainer, Core","Wrap",2026-08-31,5:23:00',
    ].join("\n");

    const result = parseClockifyDetailedCsv(csv, [
      segment(2026, 8, 1, 2026, 8, 2),
      segment(2026, 8, 3, 2026, 8, 9),
      segment(2026, 8, 10, 2026, 8, 16),
      segment(2026, 8, 17, 2026, 8, 23),
      segment(2026, 8, 24, 2026, 8, 30),
      segment(2026, 8, 31, 2026, 8, 31),
    ]);

    expect(result.ok).toBe(true);
    expect(result.totals).toEqual([0.25, 1.25, 2.5, 3.75, 4, 5.5]);
    expect(result.rawTotalHours).toBe(17.62);
    expect(result.totalHours).toBe(17.25);
  });

  it("accepts semicolon-delimited exports with decimal-comma hours", () => {
    const csv = [
      "Project;Start Date;Duration (h)",
      "Client work;2026-05-04;\"1,5\"",
      "Client work;2026-05-05;0:22",
    ].join("\n");

    const result = parseClockifyDetailedCsv(csv, [segment(2026, 5, 1, 2026, 5, 31)]);

    expect(result.ok).toBe(true);
    expect(result.totals).toEqual([1.75]);
    expect(result.rawTotalHours).toBe(1.87);
    expect(result.totalHours).toBe(1.75);
  });

  it("handles CSV files with a UTF-8 BOM and CRLF line endings", () => {
    const csv = "\uFEFFStart Date,Duration (h)\r\n2026-05-06,0:45:00\r\n";

    const result = parseClockifyDetailedCsv(csv, [segment(2026, 5, 1, 2026, 5, 31)]);

    expect(result.ok).toBe(true);
    expect(result.totals).toEqual([0.75]);
  });
});
