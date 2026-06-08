const QUARTER_HOUR_SECONDS = 15 * 60;
const ROUND_UP_THRESHOLD_SECONDS = 7.5 * 60;
const CSV_DELIMITERS = [",", ";", "\t"];
const DATE_KEYS = ["startdate", "date", "entrydate", "enddate", "start"];
const DURATION_KEYS = ["durationdecimal", "timedecimal", "durationh", "timeh", "duration", "time"];
const PREFERRED_DURATION_KEYS = ["durationh", "timeh", "duration", "time", "durationdecimal", "timedecimal"];

function roundHours(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toISODate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthValue(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function dateRangeMonthValue(startDate, endDate) {
  if (
    !startDate ||
    !endDate ||
    startDate.getUTCFullYear() !== endDate.getUTCFullYear() ||
    startDate.getUTCMonth() !== endDate.getUTCMonth()
  ) {
    return null;
  }
  return toMonthValue(startDate);
}

function roundHoursToQuarterIncrement(value) {
  const totalSeconds = Math.max(0, Math.round(value * 60 * 60));
  const fullQuarters = Math.floor(totalSeconds / QUARTER_HOUR_SECONDS);
  const remainderSeconds = totalSeconds % QUARTER_HOUR_SECONDS;
  const roundedQuarters = fullQuarters + (remainderSeconds >= ROUND_UP_THRESHOLD_SECONDS ? 1 : 0);
  return roundHours((roundedQuarters * QUARTER_HOUR_SECONDS) / 60 / 60);
}

function countDelimiterOutsideQuotes(line, delimiter) {
  let count = 0;
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }

  return count;
}

function detectCsvDelimiter(text) {
  const headerLine = String(text || "")
    .split(/\r?\n/)
    .find((line) => line.trim());

  if (!headerLine) {
    return ",";
  }

  return CSV_DELIMITERS.reduce(
    (best, delimiter) => {
      const count = countDelimiterOutsideQuotes(headerLine, delimiter);
      return count > best.count ? { delimiter, count } : best;
    },
    { delimiter: ",", count: -1 },
  ).delimiter;
}

function parseCsvRows(text) {
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((cells) => cells.some((value) => String(value).trim()));
}

function normalizeHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function createHeaderLookup(headers) {
  return headers.reduce((lookup, header, index) => {
    const key = normalizeHeader(header);
    if (key && lookup[key] === undefined) {
      lookup[key] = index;
    }
    return lookup;
  }, {});
}

function getCell(row, lookup, possibleKeys) {
  for (const key of possibleKeys) {
    const index = lookup[key];
    if (index !== undefined) {
      return String(row[index] ?? "").trim();
    }
  }
  return "";
}

function isValidDateParts(year, month, day) {
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function createDateFromParts(year, month, day) {
  if (!isValidDateParts(year, month, day)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateIsInsideRange(date, startDate, endDate) {
  return date >= startDate && date <= endDate;
}

function inferDateOrderFromText(value) {
  let foundDayFirst = false;
  let foundMonthFirst = false;
  const text = String(value || "");
  const matches = text.matchAll(/(?<!\d)(\d{1,2})[/. _-](\d{1,2})[/. _-](\d{2,4})(?!\d)/g);
  const dateParts = [];

  for (const match of matches) {
    const first = Number(match[1]);
    const second = Number(match[2]);
    const year = Number(match[3]);
    dateParts.push({ first, second, year });
    if (first > 12) {
      foundDayFirst = true;
    }
    if (second > 12) {
      foundMonthFirst = true;
    }
  }

  if (foundDayFirst && !foundMonthFirst) {
    return "dmy";
  }
  if (foundMonthFirst && !foundDayFirst) {
    return "mdy";
  }

  if (dateParts.length >= 2) {
    const firstDate = dateParts[0];
    const secondDate = dateParts[1];

    if (
      firstDate.year === secondDate.year &&
      firstDate.first === secondDate.first &&
      firstDate.second !== secondDate.second
    ) {
      return "mdy";
    }
    if (
      firstDate.year === secondDate.year &&
      firstDate.second === secondDate.second &&
      firstDate.first !== secondDate.first
    ) {
      return "dmy";
    }
  }

  return null;
}

function inferSlashDateOrder(rows, lookup, fileName) {
  const fileNameOrder = inferDateOrderFromText(fileName);
  if (fileNameOrder) {
    return fileNameOrder;
  }

  let foundDayFirst = false;
  let foundMonthFirst = false;

  for (const row of rows) {
    const text = getCell(row, lookup, DATE_KEYS);
    const rowOrder = inferDateOrderFromText(text);
    if (rowOrder === "dmy") {
      foundDayFirst = true;
    } else if (rowOrder === "mdy") {
      foundMonthFirst = true;
    }
  }

  if (foundDayFirst && !foundMonthFirst) {
    return "dmy";
  }
  if (foundMonthFirst && !foundDayFirst) {
    return "mdy";
  }
  return null;
}

function parseClockifyDate(value, periodStartDate, periodEndDate, slashDateOrder) {
  const text = String(value || "").trim();
  if (!text) {
    return null;
  }

  const isoMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return createDateFromParts(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const slashMatch = text.match(/(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})/);
  if (slashMatch) {
    const first = Number(slashMatch[1]);
    const second = Number(slashMatch[2]);
    const rawYear = Number(slashMatch[3]);
    const year = rawYear < 100 ? 2000 + rawYear : rawYear;
    const dayFirstCandidate = createDateFromParts(year, second, first);
    const monthFirstCandidate = createDateFromParts(year, first, second);

    if (slashDateOrder === "dmy") {
      return dayFirstCandidate || monthFirstCandidate;
    }
    if (slashDateOrder === "mdy") {
      return monthFirstCandidate || dayFirstCandidate;
    }

    const candidates = [dayFirstCandidate, monthFirstCandidate].filter(Boolean);

    const matchingCandidate = candidates.find((candidate) =>
      dateIsInsideRange(candidate, periodStartDate, periodEndDate),
    );
    return matchingCandidate || candidates[0] || null;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12));
}

function parseClockifyHours(value) {
  const text = String(value || "").trim();
  if (!text) {
    return 0;
  }

  const decimalText = text.includes(",") && !text.includes(".") ? text.replace(",", ".") : text.replace(/,/g, "");
  const decimal = Number(decimalText);
  if (Number.isFinite(decimal)) {
    return Math.max(0, decimal);
  }

  const durationMatch = text.match(/^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/);
  if (!durationMatch) {
    return 0;
  }

  const hours = Number(durationMatch[1]);
  const minutes = Number(durationMatch[2]);
  const seconds = Number(durationMatch[3] || 0);
  return hours + minutes / 60 + seconds / 3600;
}

export function parseClockifyDetailedCsv(text, segments, options = {}) {
  const rows = parseCsvRows(text);
  if (rows.length < 2) {
    return {
      ok: false,
      message: "That CSV looks empty. Export a Detailed report from Clockify and try again.",
    };
  }

  const headers = rows[0];
  const lookup = createHeaderLookup(headers);
  const hasDateColumn = DATE_KEYS.some((key) => lookup[key] !== undefined);
  const hasTimeColumn = DURATION_KEYS.some((key) => lookup[key] !== undefined);

  if (!hasDateColumn && hasTimeColumn) {
    return {
      ok: false,
      message: "Summary export detected. Use Clockify Detailed report as CSV so Invoice Garden can split hours by week.",
    };
  }

  if (!hasDateColumn) {
    return {
      ok: false,
      message: "No date column found. Export Clockify Detailed report as CSV.",
    };
  }

  if (!hasTimeColumn) {
    return {
      ok: false,
      message: "No duration column found. Export Clockify Detailed report as CSV.",
    };
  }

  if (!segments.length) {
    return {
      ok: false,
      message: "Set the invoice period before importing Clockify hours.",
    };
  }

  const periodStartDate = segments[0].startDate;
  const periodEndDate = segments[segments.length - 1].endDate;
  const totals = Array(segments.length).fill(0);
  const slashDateOrder = inferSlashDateOrder(rows.slice(1), lookup, options.fileName);
  let importedRows = 0;
  let skippedRows = 0;
  let matchedRowsOutsidePeriod = 0;
  let earliestEntryDate = null;
  let latestEntryDate = null;

  for (const row of rows.slice(1)) {
    const dateText = getCell(row, lookup, DATE_KEYS);
    const hoursText = getCell(row, lookup, PREFERRED_DURATION_KEYS);
    const entryDate = parseClockifyDate(dateText, periodStartDate, periodEndDate, slashDateOrder);
    const hours = parseClockifyHours(hoursText);

    if (!entryDate || hours <= 0) {
      skippedRows += 1;
      continue;
    }

    if (!earliestEntryDate || entryDate < earliestEntryDate) {
      earliestEntryDate = entryDate;
    }
    if (!latestEntryDate || entryDate > latestEntryDate) {
      latestEntryDate = entryDate;
    }

    const segmentIndex = segments.findIndex((segment) =>
      dateIsInsideRange(entryDate, segment.startDate, segment.endDate),
    );

    if (segmentIndex === -1) {
      matchedRowsOutsidePeriod += 1;
      skippedRows += 1;
      continue;
    }

    totals[segmentIndex] += hours;
    importedRows += 1;
  }

  const rawTotalHours = roundHours(totals.reduce((sum, value) => sum + value, 0));
  const roundedTotals = totals.map(roundHoursToQuarterIncrement);
  const totalHours = roundedTotals.reduce((sum, value) => sum + value, 0);

  if (!importedRows || totalHours <= 0) {
    if (matchedRowsOutsidePeriod > 0 && earliestEntryDate && latestEntryDate) {
      return {
        ok: false,
        reason: "period_mismatch",
        message: "Clockify hours found, but not inside the selected invoice period.",
        detectedStartIso: toISODate(earliestEntryDate),
        detectedEndIso: toISODate(latestEntryDate),
        detectedMonth: dateRangeMonthValue(earliestEntryDate, latestEntryDate),
      };
    }

    return {
      ok: false,
      message: "No matching hours found inside this invoice period.",
    };
  }

  return {
    ok: true,
    totals: roundedTotals,
    importedRows,
    skippedRows,
    rawTotalHours,
    totalHours: roundHours(totalHours),
  };
}
