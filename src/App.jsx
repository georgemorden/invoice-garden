import { useEffect, useMemo, useRef, useState } from "react";
import { parseClockifyDetailedCsv } from "./clockifyImport";
import BotanicalPlantProgress from "./components/BotanicalPlantProgress";
import clockifyLogoUrl from "./assets/clockify.svg";
import {
  Briefcase,
  Building2,
  CalendarRange,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  FileText,
  RefreshCw,
  Receipt,
  Save,
  Trash2,
  Upload,
  UserRound,
} from "lucide-react";

const PRESETS_KEY = "invoice-garden:presets:v1";
const PRESET_BACKUP_SCHEMA = "invoice-garden-presets:v1";
const PRESET_BACKUP_FILE_NAME = "invoice-garden-presets.json";
const MAX_PRESET_BACKUP_BYTES = 512 * 1024;
const MAX_CLOCKIFY_CSV_BYTES = 5 * 1024 * 1024;
const FIELD_LIMITS = {
  businessName: 56,
  businessEmail: 80,
  businessPhone: 24,
  businessAddress: 96,
  businessPostcode: 16,
  clientName: 56,
  clientEmail: 80,
  clientPhone: 24,
  clientAddress: 96,
  clientPostcode: 16,
  invoiceNumber: 32,
};
const PRESET_NAME_MAX_LENGTH = 44;
const MAX_HOURLY_RATE = 9999.99;
const MAX_LINE_HOURS = 168;
const LINE_HOUR_FIELDS = [
  "line1Hours",
  "line2Hours",
  "line3Hours",
  "line4Hours",
  "line5Hours",
  "line6Hours",
];
const REQUIRED_FIELDS = [
  "businessName",
  "businessEmail",
  "clientName",
  "clientEmail",
  "invoiceDate",
  "periodStart",
  "periodEnd",
  "hourlyRate",
];

const CURRENCY_CONFIG = {
  GBP: { symbol: "£", locale: "en-GB" },
  USD: { symbol: "$", locale: "en-US" },
  EUR: { symbol: "€", locale: "de-DE" },
};
const CURRENCY_OPTIONS = [
  { value: "GBP", label: "GBP (£)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
];
const MONTH_SHORT_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_SHORT_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BUILT_IN_DEMO_PRESET_ID = "__invoice_garden_demo_preset__";

const PRESET_FIELDS = [
  "businessName",
  "businessEmail",
  "businessPhone",
  "businessAddress",
  "businessPostcode",
  "clientName",
  "clientEmail",
  "clientPhone",
  "clientAddress",
  "clientPostcode",
  "currency",
  "hourlyRate",
];
const BUILT_IN_PRESETS = [
  {
    id: BUILT_IN_DEMO_PRESET_ID,
    name: "Demo preset",
    builtIn: true,
    values: {
      businessName: "Garden Studio",
      businessEmail: "hello@gardenstudio.example",
      businessPhone: "+44 7700 900123",
      businessAddress: "18 Willow Yard, Bristol",
      businessPostcode: "BS1 4QA",
      clientName: "Acorn Creative Ltd",
      clientEmail: "accounts@acorncreative.example",
      clientPhone: "+44 7700 900456",
      clientAddress: "42 Meadow Lane, Bath",
      clientPostcode: "BA1 2AB",
      currency: "GBP",
      hourlyRate: "45",
    },
  },
];
const RESERVED_PRESET_IDS = new Set(BUILT_IN_PRESETS.map((preset) => preset.id));
const GROWTH_REQUIRED_FIELDS = [
  "invoiceMonth",
  "periodStart",
  "periodEnd",
  "businessName",
  "businessEmail",
  "clientName",
  "clientEmail",
  "invoiceDate",
  "currency",
  "hourlyRate",
];
const GROWTH_OPTIONAL_FIELDS = [
  "businessPhone",
  "businessAddress",
  "businessPostcode",
  "clientPhone",
  "clientAddress",
  "clientPostcode",
];

const WORKFLOW_FOCUS_SELECTOR = [
  'button:not(:disabled):not([data-key-nav-skip="true"])',
  'input:not(:disabled):not([type="hidden"]):not([data-key-nav-skip="true"])',
  'select:not(:disabled):not([data-key-nav-skip="true"])',
  'textarea:not(:disabled):not([data-key-nav-skip="true"])',
  '[tabindex]:not([tabindex="-1"]):not([data-key-nav-skip="true"])',
].join(",");
const PDF_CAPTURE_SELECTOR = '[data-pdf-preview="true"]';

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

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function parseMonthValue(value) {
  if (!value) {
    return null;
  }
  const [yearText, monthText] = String(value).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  if (!year || !month || month < 1 || month > 12) {
    return null;
  }
  const start = new Date(Date.UTC(year, month - 1, 1, 12));
  const end = new Date(Date.UTC(year, month, 0, 12));
  return { start, end };
}

function shiftMonthValue(value, monthDelta) {
  const today = new Date();
  const fallback = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1, 12));
  const seed = parseMonthValue(value)?.start || fallback;
  const shifted = new Date(Date.UTC(seed.getUTCFullYear(), seed.getUTCMonth() + monthDelta, 1, 12));
  return toMonthValue(shifted);
}

function parseISODate(value) {
  if (!value) {
    return null;
  }
  const [yearText, monthText, dayText] = String(value).split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!year || !month || !day) {
    return null;
  }
  const parsed = new Date(Date.UTC(year, month - 1, day, 12));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function clampDateToRange(date, minDate, maxDate) {
  const time = date.getTime();
  if (time < minDate.getTime()) {
    return new Date(minDate);
  }
  if (time > maxDate.getTime()) {
    return new Date(maxDate);
  }
  return new Date(date);
}

function snapToWeekStart(date) {
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  return addDays(date, -daysSinceMonday);
}

function snapToWeekEnd(date) {
  const daysUntilSunday = (7 - date.getUTCDay()) % 7;
  return addDays(date, daysUntilSunday);
}

function formatRangeDate(date, includeYear = false) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    ...(includeYear ? { year: "numeric" } : {}),
  }).format(date);
}

function formatDateRange(start, end) {
  const includeYear = start.getUTCFullYear() !== end.getUTCFullYear();
  const startLabel = formatRangeDate(start, includeYear);
  const endLabel = formatRangeDate(end, true);
  if (toISODate(start) === toISODate(end)) {
    return startLabel;
  }
  return `${startLabel} - ${endLabel}`;
}

function formatCompactDateRange(start, end) {
  const startLabel = formatRangeDate(start, false);
  const endLabel = formatRangeDate(end, false);
  if (toISODate(start) === toISODate(end)) {
    return startLabel;
  }
  return `${startLabel} - ${endLabel}`;
}

function formatMonthDisplay(value) {
  const bounds = parseMonthValue(value);
  if (!bounds) {
    return "Select month";
  }
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(bounds.start);
}

function formatDateDisplay(value) {
  const date = parseISODate(value);
  if (!date) {
    return "Select date";
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getMonthYear(value) {
  const bounds = parseMonthValue(value);
  return bounds?.start.getUTCFullYear() || new Date().getUTCFullYear();
}

function getDatePickerMonth(value, fallbackValue) {
  const date = parseISODate(value) || parseISODate(fallbackValue);
  if (!date) {
    const now = new Date();
    return toMonthValue(new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 12)));
  }
  return toMonthValue(date);
}

function buildCalendarCells(monthValue, minIso, maxIso) {
  const bounds = parseMonthValue(monthValue);
  if (!bounds) {
    return [];
  }

  const minDate = parseISODate(minIso);
  const maxDate = parseISODate(maxIso);
  const firstDayOffset = (bounds.start.getUTCDay() + 6) % 7;
  const cells = Array.from({ length: firstDayOffset }, (_, index) => ({
    key: `blank-${index}`,
    blank: true,
  }));

  for (let cursor = new Date(bounds.start); cursor <= bounds.end; cursor = addDays(cursor, 1)) {
    const iso = toISODate(cursor);
    const disabled = Boolean(
      (minDate && cursor.getTime() < minDate.getTime()) ||
        (maxDate && cursor.getTime() > maxDate.getTime()),
    );
    cells.push({
      key: iso,
      iso,
      day: cursor.getUTCDate(),
      disabled,
    });
  }

  return cells;
}

function parseNonNegative(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
}

function limitTextValue(field, value) {
  const text = String(value ?? "");
  const maxLength = FIELD_LIMITS[field];
  return maxLength ? text.slice(0, maxLength) : text;
}

function limitPresetName(value) {
  return String(value ?? "").slice(0, PRESET_NAME_MAX_LENGTH);
}

function limitNumberValue(field, value) {
  if (value === "") {
    return "";
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const max = field === "hourlyRate" ? MAX_HOURLY_RATE : MAX_LINE_HOURS;
  const clamped = Math.min(max, Math.max(0, numeric));
  return String(Math.round(clamped * 100) / 100);
}

function limitFormValue(field, value) {
  if (field === "currency") {
    return normalizeCurrency(value);
  }
  if (field === "hourlyRate" || LINE_HOUR_FIELDS.includes(field)) {
    return limitNumberValue(field, value) ?? "";
  }
  return limitTextValue(field, value);
}

function normalizeCurrency(currency) {
  return CURRENCY_CONFIG[currency] ? currency : "GBP";
}

function formatHours(value) {
  return Number(value).toFixed(2).replace(/\.00$/, "");
}

function sanitizeFileName(value) {
  return String(value || "")
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatCurrency(amount, currency) {
  const normalizedCurrency = normalizeCurrency(currency);
  const config = CURRENCY_CONFIG[normalizedCurrency];
  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount || 0);
}

function nextAnimationFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function waitForPdfCaptureReady() {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // Font readiness should improve the capture, but it should never block export.
    }
  }

  await nextAnimationFrame();
  await nextAnimationFrame();
}

function preparePdfCaptureClone(clonedDocument, width) {
  const clonedPaper = clonedDocument.querySelector(PDF_CAPTURE_SELECTOR);
  if (!clonedPaper) {
    return;
  }

  const captureReset = clonedDocument.createElement("style");
  captureReset.textContent = `
    ${PDF_CAPTURE_SELECTOR},
    ${PDF_CAPTURE_SELECTOR} * {
      animation: none !important;
      transition: none !important;
      filter: none !important;
      opacity: 1 !important;
    }

    ${PDF_CAPTURE_SELECTOR} {
      width: ${width}px !important;
      max-width: none !important;
      transform: none !important;
      background: #ffffff !important;
      color: #131c2d !important;
      box-shadow: none !important;
    }
  `;
  clonedDocument.head.append(captureReset);
}

function readLocalValue(key) {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLocalValue(key, value) {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // The app still works if browser storage is blocked; presets just become session-only.
  }
}

function buildSuggestedSegments(periodStart, periodEnd) {
  const startDate = parseISODate(periodStart);
  const endDate = parseISODate(periodEnd);
  if (!startDate || !endDate || endDate < startDate) {
    return { mode: "Not ready", segments: [] };
  }

  const segments = [];
  let cursor = new Date(startDate);

  while (cursor <= endDate) {
    const daysUntilSunday = (7 - cursor.getUTCDay()) % 7;
    const chunkEnd = addDays(cursor, daysUntilSunday);
    const boundedEnd = chunkEnd > endDate ? new Date(endDate) : chunkEnd;

    segments.push({
      startDate: new Date(cursor),
      endDate: boundedEnd,
      startIso: toISODate(cursor),
      endIso: toISODate(boundedEnd),
      rangeLabel: formatDateRange(cursor, boundedEnd),
    });

    cursor = addDays(boundedEnd, 1);
  }

  return { mode: "Weekly", segments };
}

function createClearedForm() {
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12));
  const periodStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 12));
  const periodEnd = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 12));

  return {
    businessName: "",
    businessEmail: "",
    businessPhone: "",
    businessAddress: "",
    businessPostcode: "",
    clientName: "",
    clientEmail: "",
    clientPhone: "",
    clientAddress: "",
    clientPostcode: "",
    invoiceNumber: "",
    invoiceDate: toISODate(today),
    invoiceMonth: toMonthValue(periodStart),
    periodStart: toISODate(periodStart),
    periodEnd: toISODate(periodEnd),
    currency: "GBP",
    hourlyRate: "",
    line1Hours: "",
    line2Hours: "",
    line3Hours: "",
    line4Hours: "",
    line5Hours: "",
    line6Hours: "",
  };
}

function validateForm(form) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  for (const field of REQUIRED_FIELDS) {
    if (!String(form[field] ?? "").trim()) {
      errors[field] = "Required";
    }
  }

  if (form.businessEmail && !emailPattern.test(form.businessEmail.trim())) {
    errors.businessEmail = "Enter a valid email";
  }
  if (form.clientEmail && !emailPattern.test(form.clientEmail.trim())) {
    errors.clientEmail = "Enter a valid email";
  }

  if (parseNonNegative(form.hourlyRate) <= 0) {
    errors.hourlyRate = "Must be greater than 0";
  }

  if (form.periodStart && form.periodEnd && form.periodEnd < form.periodStart) {
    errors.periodEnd = "Period end should be on or after period start";
  }

  return errors;
}

function loadPresets(rawValue) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (preset) =>
          preset &&
          typeof preset === "object" &&
          preset.id &&
          !RESERVED_PRESET_IDS.has(String(preset.id)) &&
          preset.name &&
          preset.values,
      )
      .map((preset) => {
        const values = PRESET_FIELDS.reduce((nextValues, field) => {
          nextValues[field] = limitFormValue(field, preset.values[field] ?? "");
          return nextValues;
        }, {});
        values.currency = normalizeCurrency(values.currency);

        return {
          id: String(preset.id),
          name: limitPresetName(preset.name).trim() || "Saved preset",
          updatedAt: preset.updatedAt || "",
          values,
        };
      });
  } catch {
    return [];
  }
}

function mergePresets(...presetLists) {
  const presetsById = new Map();

  for (const presetList of presetLists) {
    for (const preset of presetList) {
      presetsById.set(preset.id, preset);
    }
  }

  return Array.from(presetsById.values()).sort((a, b) => {
    const bTime = Date.parse(b.updatedAt || "") || 0;
    const aTime = Date.parse(a.updatedAt || "") || 0;
    return bTime - aTime;
  });
}

function readStoredPresets() {
  return mergePresets(loadPresets(readLocalValue(PRESETS_KEY)));
}

function writeStoredPresets(presets) {
  const value = JSON.stringify(presets);
  writeLocalValue(PRESETS_KEY, value);
}

function parsePresetBackup(rawValue) {
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    const presetPayload = Array.isArray(parsed) ? parsed : parsed?.presets;

    if (!Array.isArray(presetPayload)) {
      return [];
    }

    return loadPresets(JSON.stringify(presetPayload));
  } catch {
    return [];
  }
}

function createPresetBackup(presets) {
  return JSON.stringify(
    {
      schema: PRESET_BACKUP_SCHEMA,
      exportedAt: new Date().toISOString(),
      presets,
    },
    null,
    2,
  );
}

function createPresetId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `preset-${Date.now()}`;
}

function getPresetValues(form) {
  return PRESET_FIELDS.reduce((values, field) => {
    values[field] = limitFormValue(field, form[field] ?? "");
    return values;
  }, {});
}

function getSuggestedPresetName(form) {
  return form.clientName || form.businessName || "Primary client";
}

function fieldHasValue(value) {
  return Boolean(String(value ?? "").trim());
}

function fieldHasGrowthValue(form, field) {
  if (!fieldHasValue(form[field])) {
    return false;
  }

  if (field === "invoiceMonth") {
    return Boolean(parseMonthValue(form[field]));
  }
  if (field === "periodStart" || field === "periodEnd" || field === "invoiceDate") {
    return Boolean(parseISODate(form[field]));
  }
  if (field === "businessEmail" || field === "clientEmail") {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(form[field]).trim());
  }
  if (field === "hourlyRate") {
    return parseNonNegative(form[field]) > 0;
  }
  if (field === "currency") {
    return Boolean(CURRENCY_CONFIG[normalizeCurrency(form[field])]);
  }

  return true;
}

function calculateBotanicalGrowth(form, calculations) {
  const visibleHourFields = LINE_HOUR_FIELDS.slice(0, Math.max(1, calculations.lineRows.length));
  const inputFields = [...GROWTH_REQUIRED_FIELDS, ...GROWTH_OPTIONAL_FIELDS];
  const completedInputUnits = inputFields.reduce(
    (sum, field) => sum + (fieldHasGrowthValue(form, field) ? 1 : 0),
    0,
  );
  const completedHourUnits = visibleHourFields.reduce(
    (sum, field) => sum + (parseNonNegative(form[field]) > 0 ? 1 : 0),
    0,
  );

  return {
    completedUnits: completedInputUnits + completedHourUnits,
    totalUnits: inputFields.length + visibleHourFields.length,
  };
}

function FormField({ label, required, error, children, className = "" }) {
  return (
    <label className={`field ${className}`.trim()}>
      <span className="field-label">
        {label}
        {required ? <em>*</em> : null}
      </span>
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}

function AppMonthPicker({ value, viewYear, isOpen, onOpen, onSelect, onYearChange, onSelectCurrentMonth }) {
  return (
    <div className={`control-popover-root ${isOpen ? "is-open" : ""}`} data-popover-root>
      <button
        type="button"
        className={`app-picker-trigger ${isOpen ? "open" : ""}`}
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span>{formatMonthDisplay(value)}</span>
        <CalendarRange size={14} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="control-popover month-popover" role="dialog" aria-label="Select month">
          <div className="popover-toolbar">
            <button type="button" className="mini-icon-button" onClick={() => onYearChange(viewYear - 1)} aria-label="Previous year">
              <ChevronLeft size={14} />
            </button>
            <span>{viewYear}</span>
            <button type="button" className="mini-icon-button" onClick={() => onYearChange(viewYear + 1)} aria-label="Next year">
              <ChevronRight size={14} />
            </button>
          </div>
          <button type="button" className="popover-quick-action" onClick={onSelectCurrentMonth}>
            This month
          </button>
          <div className="month-option-grid">
            {MONTH_SHORT_LABELS.map((monthLabel, index) => {
              const monthValue = `${viewYear}-${String(index + 1).padStart(2, "0")}`;
              const selected = monthValue === value;
              return (
                <button
                  key={monthValue}
                  type="button"
                  className={`month-option ${selected ? "selected" : ""}`}
                  onClick={() => onSelect(monthValue)}
                >
                  {monthLabel}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AppDatePicker({ value, viewMonth, min, max, isOpen, onOpen, onSelect, onViewMonthChange }) {
  const cells = buildCalendarCells(viewMonth, min, max);
  const selectedDate = parseISODate(value);

  return (
    <div className={`control-popover-root ${isOpen ? "is-open" : ""}`} data-popover-root>
      <button
        type="button"
        className={`app-picker-trigger ${isOpen ? "open" : ""}`}
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <span>{formatDateDisplay(value)}</span>
        <CalendarRange size={14} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="control-popover date-popover" role="dialog" aria-label="Select date">
          <div className="popover-toolbar">
            <button
              type="button"
              className="mini-icon-button"
              onClick={() => onViewMonthChange(shiftMonthValue(viewMonth, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={14} />
            </button>
            <span>{formatMonthDisplay(viewMonth)}</span>
            <button
              type="button"
              className="mini-icon-button"
              onClick={() => onViewMonthChange(shiftMonthValue(viewMonth, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={14} />
            </button>
          </div>
          <div className="calendar-grid calendar-weekdays" aria-hidden="true">
            {WEEKDAY_SHORT_LABELS.map((weekday) => (
              <span key={weekday}>{weekday}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {cells.map((cell) =>
              cell.blank ? (
                <span key={cell.key} className="calendar-blank" />
              ) : (
                <button
                  key={cell.key}
                  type="button"
                  className={`calendar-day ${cell.iso === value ? "selected" : ""}`}
                  onClick={() => onSelect(cell.iso)}
                  disabled={cell.disabled}
                  aria-label={formatDateDisplay(cell.iso)}
                  aria-current={selectedDate && toISODate(selectedDate) === cell.iso ? "date" : undefined}
                >
                  {cell.day}
                </button>
              ),
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AppDropdown({ value, options, isOpen, onOpen, onSelect, ariaLabel }) {
  const selectedOption = options.find((option) => option.value === value) || options[0];

  return (
    <div className={`control-popover-root ${isOpen ? "is-open" : ""}`} data-popover-root>
      <button
        type="button"
        className={`app-picker-trigger ${isOpen ? "open" : ""}`}
        onClick={onOpen}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span>{selectedOption?.label || "Select"}</span>
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {isOpen ? (
        <div className="control-popover dropdown-popover" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => {
            const selected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                className={`dropdown-option ${selected ? "selected" : ""}`}
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(option.value)}
              >
                <span>{option.label}</span>
                {selected ? <Check size={14} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function CompletionProgress({ steps, growth }) {
  const completedCount = steps.filter((step) => step.isComplete).length;
  const progressLabel = `${completedCount} of ${steps.length} sections complete`;

  return (
    <section className="completion-progress" aria-label="Completion progress">
      <div className="completion-visual" aria-hidden="true">
        <BotanicalPlantProgress completedUnits={growth.completedUnits} totalUnits={growth.totalUnits} />
      </div>
      <span className="sr-only">{progressLabel}</span>
    </section>
  );
}

function isEditableTarget(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("input, textarea, select, [contenteditable='true'], [data-popover-root]"));
}

function isTouchNavigationExcluded(target) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest(
      "input, textarea, select, button, a, [contenteditable='true'], [data-popover-root], [data-key-nav-skip='true']",
    ),
  );
}

export default function App() {
  const [form, setForm] = useState(() => createClearedForm());
  const [presets, setPresets] = useState(() => readStoredPresets());
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [touched, setTouched] = useState({});
  const [toast, setToast] = useState("");
  const [clockifyImportStatus, setClockifyImportStatus] = useState(null);
  const [clockifyImportPulse, setClockifyImportPulse] = useState(0);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  const [isPresetDialogOpen, setIsPresetDialogOpen] = useState(false);
  const [isPresetDeleteDialogOpen, setIsPresetDeleteDialogOpen] = useState(false);
  const [presetNameDraft, setPresetNameDraft] = useState("");
  const [presetNameError, setPresetNameError] = useState("");
  const [openControl, setOpenControl] = useState(null);
  const [datePickerViewMonth, setDatePickerViewMonth] = useState(() => getDatePickerMonth(createClearedForm().invoiceDate));
  const [monthPickerYear, setMonthPickerYear] = useState(() => getMonthYear(createClearedForm().invoiceMonth));
  const [activeStep, setActiveStep] = useState(0);
  const [workflowSwipeOffset, setWorkflowSwipeOffset] = useState(0);
  const [workflowIsSwiping, setWorkflowIsSwiping] = useState(false);
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const presetImportInputRef = useRef(null);
  const presetDropdownRef = useRef(null);
  const presetDialogInputRef = useRef(null);
  const stepTabRefs = useRef([]);
  const stepPaneRef = useRef(null);
  const workflowTouchStartRef = useRef(null);
  const workflowTouchDeltaRef = useRef({ x: 0, y: 0 });
  const workflowTouchSkipRef = useRef(false);
  const toastTimerRef = useRef(null);
  const clearTimerRef = useRef(null);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "light");
  }, []);

  useEffect(() => {
    writeStoredPresets(presets);
  }, [presets]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isPresetMenuOpen) {
      return undefined;
    }

    function handlePresetMenuClose(event) {
      if (event.key === "Escape") {
        setIsPresetMenuOpen(false);
        return;
      }

      if (
        event.type === "mousedown" &&
        presetDropdownRef.current &&
        event.target instanceof Node &&
        !presetDropdownRef.current.contains(event.target)
      ) {
        setIsPresetMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePresetMenuClose);
    document.addEventListener("keydown", handlePresetMenuClose);
    return () => {
      document.removeEventListener("mousedown", handlePresetMenuClose);
      document.removeEventListener("keydown", handlePresetMenuClose);
    };
  }, [isPresetMenuOpen]);

  useEffect(() => {
    if (!openControl) {
      return undefined;
    }

    function handleControlPopoverClose(event) {
      if (event.key === "Escape") {
        setOpenControl(null);
        return;
      }

      if (
        event.type === "mousedown" &&
        event.target instanceof Element &&
        !event.target.closest("[data-popover-root]")
      ) {
        setOpenControl(null);
      }
    }

    document.addEventListener("mousedown", handleControlPopoverClose);
    document.addEventListener("keydown", handleControlPopoverClose);
    return () => {
      document.removeEventListener("mousedown", handleControlPopoverClose);
      document.removeEventListener("keydown", handleControlPopoverClose);
    };
  }, [openControl]);

  useEffect(() => {
    setOpenControl(null);
  }, [activeStep]);

  useEffect(() => {
    if (!isPresetDialogOpen && !isPresetDeleteDialogOpen) {
      return undefined;
    }

    requestAnimationFrame(() => {
      presetDialogInputRef.current?.focus();
      presetDialogInputRef.current?.select();
    });

    function handlePresetDialogKeydown(event) {
      if (event.key === "Escape") {
        setIsPresetDialogOpen(false);
        setIsPresetDeleteDialogOpen(false);
      }
    }

    document.addEventListener("keydown", handlePresetDialogKeydown);
    return () => document.removeEventListener("keydown", handlePresetDialogKeydown);
  }, [isPresetDialogOpen, isPresetDeleteDialogOpen]);

  const errors = useMemo(() => validateForm(form), [form]);
  const monthBounds = useMemo(() => parseMonthValue(form.invoiceMonth), [form.invoiceMonth]);
  const suggestedSplit = useMemo(
    () => buildSuggestedSegments(form.periodStart, form.periodEnd),
    [form.periodStart, form.periodEnd],
  );

  const calculations = useMemo(() => {
    const hourlyRate = parseNonNegative(form.hourlyRate);
    const lineRows = suggestedSplit.segments.slice(0, LINE_HOUR_FIELDS.length).map((segment, index) => {
      const hours = parseNonNegative(form[LINE_HOUR_FIELDS[index]]);
      return {
        rowKey: `${segment.startIso}-${segment.endIso}`,
        rangeLabel: segment.rangeLabel,
        compactRangeLabel: formatCompactDateRange(segment.startDate, segment.endDate),
        hours,
        amount: hours * hourlyRate,
      };
    });

    const totalHours = lineRows.reduce((sum, row) => sum + row.hours, 0);
    const subtotal = totalHours * hourlyRate;
    const totalDue = subtotal;
    const periodStartDate = parseISODate(form.periodStart);
    const periodEndDate = parseISODate(form.periodEnd);

    return {
      lineRows,
      hourlyRate,
      totalHours,
      subtotal,
      totalDue,
      periodLabel:
        periodStartDate && periodEndDate && periodEndDate >= periodStartDate
          ? formatDateRange(periodStartDate, periodEndDate)
          : "-",
      billableRows: lineRows.filter((row) => row.hours > 0),
    };
  }, [form, suggestedSplit]);

  const activeCurrency = normalizeCurrency(form.currency);
  const invoiceIncomplete = Object.keys(errors).length > 0 || calculations.totalHours <= 0;
  const botanicalGrowth = useMemo(
    () => calculateBotanicalGrowth(form, calculations),
    [calculations, form],
  );

  const exportChecklist = [
    { label: "business name", complete: Boolean(form.businessName.trim()) && !errors.businessName },
    { label: "valid business email", complete: Boolean(form.businessEmail.trim()) && !errors.businessEmail },
    { label: "client name", complete: Boolean(form.clientName.trim()) && !errors.clientName },
    { label: "valid client email", complete: Boolean(form.clientEmail.trim()) && !errors.clientEmail },
    { label: "invoice date", complete: Boolean(form.invoiceDate.trim()) && !errors.invoiceDate },
    { label: "period", complete: Boolean(form.periodStart && form.periodEnd && !errors.periodStart && !errors.periodEnd) },
    { label: "rate", complete: calculations.hourlyRate > 0 && !errors.hourlyRate },
    { label: "hours", complete: calculations.totalHours > 0 },
  ];
  const missingExportItems = exportChecklist.filter((item) => !item.complete).map((item) => item.label);
  const exportReady = missingExportItems.length === 0;
  const pdfFileName = `invoice-${sanitizeFileName(form.invoiceNumber) || "draft"}.pdf`;
  const pdfButtonTitle = exportReady
    ? `Export ${pdfFileName}`
    : `Missing ${missingExportItems.slice(0, 3).join(", ")}${missingExportItems.length > 3 ? "..." : ""}`;

  const availablePresets = useMemo(() => [...BUILT_IN_PRESETS, ...presets], [presets]);
  const selectedUserPreset = useMemo(
    () => presets.find((preset) => preset.id === selectedPresetId) || null,
    [presets, selectedPresetId],
  );
  const selectedPreset = useMemo(
    () => availablePresets.find((preset) => preset.id === selectedPresetId) || null,
    [availablePresets, selectedPresetId],
  );
  const presetModalOpen = isPresetDialogOpen || isPresetDeleteDialogOpen;

  function showToast(message) {
    setToast(message);
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = setTimeout(() => {
      setToast("");
    }, 2600);
  }

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: limitFormValue(field, value) }));
  }

  function selectPreset(nextPresetId) {
    setSelectedPresetId(nextPresetId);
    const nextPreset = availablePresets.find((preset) => preset.id === nextPresetId);

    if (!nextPreset) {
      setForm(createClearedForm());
      setTouched({});
      setClockifyImportStatus(null);
      setClockifyImportPulse(0);
      return;
    }

    setForm((prev) => ({
      ...prev,
      ...PRESET_FIELDS.reduce((values, field) => {
        values[field] = limitFormValue(field, nextPreset.values[field] ?? "");
        return values;
      }, {}),
    }));
    setTouched({});
    setClockifyImportStatus(null);
    setClockifyImportPulse(0);
    showToast(`${nextPreset.name} applied`);
  }

  function openPresetDialog() {
    const defaultName = selectedUserPreset?.name || selectedPreset?.name || getSuggestedPresetName(form);
    setPresetNameDraft(limitPresetName(defaultName));
    setPresetNameError("");
    setIsPresetMenuOpen(false);
    setIsPresetDialogOpen(true);
  }

  function savePreset(event) {
    event.preventDefault();
    const name = limitPresetName(presetNameDraft).trim();
    if (!name) {
      setPresetNameError("Preset name required");
      return;
    }

    const nowIso = new Date().toISOString();
    const values = getPresetValues(form);

    if (selectedUserPreset) {
      setPresets((prev) =>
        prev.map((preset) =>
          preset.id === selectedUserPreset.id
            ? {
                ...preset,
                name,
                values,
                updatedAt: nowIso,
              }
            : preset,
        ),
      );
      setIsPresetDialogOpen(false);
      showToast("Preset updated in this browser");
      return;
    }

    const newPreset = {
      id: createPresetId(),
      name,
      values,
      updatedAt: nowIso,
    };
    setPresets((prev) => [newPreset, ...prev]);
    setSelectedPresetId(newPreset.id);
    setIsPresetDialogOpen(false);
    showToast("Preset saved in this browser");
  }

  function openDeletePresetDialog() {
    if (!selectedUserPreset) {
      return;
    }
    setIsPresetMenuOpen(false);
    setIsPresetDeleteDialogOpen(true);
  }

  function exportPresets() {
    setIsPresetMenuOpen(false);

    if (!selectedUserPreset) {
      showToast("Select a saved preset to export");
      return;
    }

    const blob = new Blob([createPresetBackup([selectedUserPreset])], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = PRESET_BACKUP_FILE_NAME;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast(`Downloaded backup for ${selectedUserPreset.name}`);
  }

  function openPresetImport() {
    setIsPresetMenuOpen(false);
    presetImportInputRef.current?.click();
  }

  async function importPresetBackup(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.size > MAX_PRESET_BACKUP_BYTES) {
      showToast("Preset backup is too large");
      return;
    }

    try {
      const importedPresets = parsePresetBackup(await file.text());

      if (!importedPresets.length) {
        showToast("No presets found in file");
        return;
      }

      setPresets((prev) => mergePresets(prev, importedPresets));
      showToast(`Imported ${importedPresets.length} preset${importedPresets.length === 1 ? "" : "s"} from backup`);
    } catch {
      showToast("Could not import presets");
    }
  }

  function deleteSelectedPreset() {
    if (!selectedUserPreset) {
      return;
    }

    setPresets((prev) => prev.filter((preset) => preset.id !== selectedUserPreset.id));
    setSelectedPresetId("");
    setForm(createClearedForm());
    setTouched({});
    setClockifyImportStatus(null);
    setClockifyImportPulse(0);
    setIsPresetDeleteDialogOpen(false);
    showToast("Preset deleted");
  }

  function updateFormValue(name, value) {
    if (name === "invoiceMonth") {
      const bounds = parseMonthValue(value);
      setForm((prev) => ({
        ...prev,
        invoiceMonth: value,
        ...(bounds
          ? {
              periodStart: toISODate(bounds.start),
              periodEnd: toISODate(bounds.end),
            }
          : {}),
      }));
      return;
    }
    if (name === "periodStart") {
      setForm((prev) => ({
        ...prev,
        ...(function computeRange() {
          const bounds = parseMonthValue(prev.invoiceMonth);
          const parsed = parseISODate(value);
          if (!bounds || !parsed) {
            return {
              periodStart: value,
              periodEnd: prev.periodEnd && prev.periodEnd < value ? value : prev.periodEnd,
            };
          }

          const nextStart = clampDateToRange(snapToWeekStart(parsed), bounds.start, bounds.end);
          const prevEnd = parseISODate(prev.periodEnd) || bounds.end;
          let nextEnd = clampDateToRange(snapToWeekEnd(prevEnd), bounds.start, bounds.end);
          if (nextEnd.getTime() < nextStart.getTime()) {
            nextEnd = new Date(nextStart);
          }

          return {
            periodStart: toISODate(nextStart),
            periodEnd: toISODate(nextEnd),
          };
        })(),
      }));
      return;
    }
    if (name === "periodEnd") {
      setForm((prev) => ({
        ...prev,
        ...(function computeRange() {
          const bounds = parseMonthValue(prev.invoiceMonth);
          const parsed = parseISODate(value);
          if (!bounds || !parsed) {
            return { periodEnd: value };
          }

          const nextEnd = clampDateToRange(snapToWeekEnd(parsed), bounds.start, bounds.end);
          const prevStart = parseISODate(prev.periodStart) || bounds.start;
          let nextStart = clampDateToRange(snapToWeekStart(prevStart), bounds.start, bounds.end);
          if (nextStart.getTime() > nextEnd.getTime()) {
            nextStart = new Date(nextEnd);
          }

          return {
            periodStart: toISODate(nextStart),
            periodEnd: toISODate(nextEnd),
          };
        })(),
      }));
      return;
    }
    updateField(name, value);
  }

  function handleInputChange(event) {
    const { name, value } = event.target;
    updateFormValue(name, value);
  }

  function openControlPicker(controlName) {
    setOpenControl((currentControl) => (currentControl === controlName ? null : controlName));
    if (controlName === "invoiceMonth") {
      setMonthPickerYear(getMonthYear(form.invoiceMonth));
    }
    if (controlName === "invoiceDate" || controlName === "periodStart" || controlName === "periodEnd") {
      setDatePickerViewMonth(getDatePickerMonth(form[controlName], form.invoiceMonth));
    }
  }

  function selectControlValue(name, value) {
    updateFormValue(name, value);
    if (name === "invoiceDate" || name === "periodStart" || name === "periodEnd") {
      setTouched((prev) => ({ ...prev, [name]: true }));
    }
    setOpenControl(null);
  }

  function setInvoiceDateToToday() {
    const now = new Date();
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12));
    updateFormValue("invoiceDate", toISODate(today));
  }

  function setInvoiceMonthToCurrent() {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const bounds = parseMonthValue(currentMonth);
    setForm((prev) => ({
      ...prev,
      invoiceMonth: currentMonth,
      ...(bounds
        ? {
            periodStart: toISODate(bounds.start),
            periodEnd: toISODate(bounds.end),
          }
        : {}),
    }));
    setMonthPickerYear(now.getFullYear());
    setOpenControl(null);
  }

  function handleNumberChange(event) {
    const { name, value } = event.target;
    const nextValue = limitNumberValue(name, value);
    if (nextValue === null) {
      return;
    }
    updateField(name, nextValue);
  }

  async function handleClockifyImport(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      const message = "Use the CSV export for Clockify import.";
      setClockifyImportStatus({ type: "error", message });
      showToast(message);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_CLOCKIFY_CSV_BYTES) {
      const message = "CSV is too large for this local import.";
      setClockifyImportStatus({ type: "error", message });
      showToast("Try a smaller Clockify export");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      const importOptions = { fileName: file.name };
      let result = parseClockifyDetailedCsv(text, suggestedSplit.segments, importOptions);
      let periodUpdates = {};
      let periodAdjusted = false;

      if (!result.ok && result.reason === "period_mismatch" && result.detectedMonth) {
        const detectedMonth = result.detectedMonth;
        const bounds = parseMonthValue(result.detectedMonth);
        if (bounds) {
          const periodStart = toISODate(bounds.start);
          const periodEnd = toISODate(bounds.end);
          const retrySplit = buildSuggestedSegments(periodStart, periodEnd);
          const retryResult = parseClockifyDetailedCsv(text, retrySplit.segments, importOptions);

          if (retryResult.ok) {
            result = retryResult;
            periodAdjusted = true;
            periodUpdates = {
              invoiceMonth: detectedMonth || toMonthValue(bounds.start),
              periodStart,
              periodEnd,
            };
          }
        }
      }

      if (!result.ok) {
        setClockifyImportStatus({ type: "error", message: result.message });
        showToast(
          result.reason === "period_mismatch" ? "Invoice period does not match CSV" : "Clockify import needs a detailed CSV",
        );
        event.target.value = "";
        return;
      }

      const importTotals = LINE_HOUR_FIELDS.map((field, index) =>
        parseNonNegative(limitFormValue(field, result.totals[index] || 0)),
      );
      const importedTotalHours = Math.round(
        (importTotals.reduce((sum, value) => sum + value, 0) + Number.EPSILON) * 100,
      ) / 100;
      const importWasCapped = importTotals.some(
        (hours, index) => hours < parseNonNegative(result.totals[index] || 0),
      );

      setForm((prev) => {
        const importedHours = LINE_HOUR_FIELDS.reduce((updates, field, index) => {
          const hours = importTotals[index] || 0;
          updates[field] = hours > 0 ? String(hours) : "";
          return updates;
        }, {});
        return { ...prev, ...periodUpdates, ...importedHours };
      });
      setClockifyImportPulse((prev) => prev + 1);

      const billedDelta = importedTotalHours - result.rawTotalHours;
      const billedDeltaText =
        Math.abs(billedDelta) < 0.01
          ? "0h rounded"
          : `${formatHours(Math.abs(billedDelta))}h ${billedDelta > 0 ? "added" : "rounded down"}`;
      const skippedText = result.skippedRows ? ` ${result.skippedRows} rows skipped.` : "";
      const billedText = importWasCapped
        ? `${formatHours(importedTotalHours)}h billed | ${MAX_LINE_HOURS}h weekly cap applied`
        : `${formatHours(importedTotalHours)}h billed | ${billedDeltaText}`;
      const periodText = periodAdjusted
        ? `${formatDateRange(parseISODate(periodUpdates.periodStart), parseISODate(periodUpdates.periodEnd))} | `
        : "";
      setClockifyImportStatus({
        type: "success",
        message: `${periodText}${formatHours(result.rawTotalHours)}h imported | ${billedText}${skippedText}`,
      });
      showToast("Clockify hours imported");
    } catch (error) {
      console.error(error);
      const message = "Could not read that Clockify CSV.";
      setClockifyImportStatus({ type: "error", message });
      showToast(message);
    } finally {
      event.target.value = "";
    }
  }

  function markTouched(event) {
    const { name } = event.target;
    if (!name) {
      return;
    }
    setTouched((prev) => ({ ...prev, [name]: true }));
  }

  async function downloadPdf() {
    if (!previewRef.current) {
      return;
    }
    if (invoiceIncomplete) {
      setTouched((prev) =>
        REQUIRED_FIELDS.reduce(
          (nextTouched, field) => ({
            ...nextTouched,
            [field]: true,
          }),
          prev,
        ),
      );
      showToast("Complete the invoice before exporting");
      return;
    }

    setIsPdfExporting(true);
    try {
      await waitForPdfCaptureReady();

      const previewNode = previewRef.current;
      if (!previewNode) {
        return;
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const previewRect = previewNode.getBoundingClientRect();
      const captureWidth = Math.ceil(previewNode.scrollWidth || previewRect.width);
      const captureHeight = Math.ceil(previewNode.scrollHeight || previewRect.height);
      const captureScale = Math.min(window.devicePixelRatio || 2, 2);

      const canvas = await html2canvas(previewNode, {
        scale: captureScale,
        backgroundColor: "#ffffff",
        useCORS: true,
        logging: false,
        width: captureWidth,
        height: captureHeight,
        windowWidth: Math.max(document.documentElement.clientWidth, captureWidth),
        windowHeight: Math.max(document.documentElement.clientHeight, captureHeight),
        onclone: (clonedDocument) => preparePdfCaptureClone(clonedDocument, captureWidth),
      });

      if (!canvas.width || !canvas.height) {
        throw new Error("PDF capture produced an empty canvas.");
      }

      const image = canvas.toDataURL("image/jpeg", 0.98);
      const pdf = new jsPDF({ unit: "pt", format: "a4", orientation: "portrait" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 28;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;
      const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
      const renderWidth = canvas.width * scale;
      const renderHeight = canvas.height * scale;
      const x = (pageWidth - renderWidth) / 2;
      const y = margin;

      pdf.addImage(image, "JPEG", x, y, renderWidth, renderHeight);

      pdf.save(pdfFileName);
      showToast("PDF downloaded");
    } catch (error) {
      console.error(error);
      showToast("Could not export PDF");
    } finally {
      setIsPdfExporting(false);
    }
  }

  function resetForm() {
    const cleared = createClearedForm();
    setForm(cleared);
    setActiveStep(0);
    setTouched({});
    setClockifyImportStatus(null);
    setClockifyImportPulse(0);
    setSelectedPresetId("");
    showToast("Values cleared");
  }

  function handleClearForm() {
    setIsClearing(true);
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
    }
    clearTimerRef.current = setTimeout(() => {
      setIsClearing(false);
    }, 620);
    resetForm();
  }

  function fieldError(field) {
    return touched[field] ? errors[field] : "";
  }

  const formSteps = [
    { title: "Period", icon: CalendarRange },
    { title: "Business", icon: Building2 },
    { title: "Client", icon: UserRound },
    { title: "Invoice", icon: Receipt },
    { title: "Work", icon: Briefcase },
  ];
  const stepCount = formSteps.length;

  useEffect(() => {
    function handlePanelKeydown(event) {
      if (
        event.defaultPrevented ||
        presetModalOpen ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        isEditableTarget(event.target)
      ) {
        return;
      }

      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
        return;
      }

      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      setActiveStep((currentStep) => Math.max(0, Math.min(stepCount - 1, currentStep + direction)));
    }

    document.addEventListener("keydown", handlePanelKeydown);
    return () => document.removeEventListener("keydown", handlePanelKeydown);
  }, [presetModalOpen, stepCount]);

  function stepHasBlockingErrors(stepIndex) {
    if (stepIndex === 0) {
      if (!String(form.invoiceMonth || "").trim()) {
        return true;
      }
      return Boolean(errors.periodStart || errors.periodEnd);
    }
    if (stepIndex === 1) {
      return Boolean(errors.businessName || errors.businessEmail);
    }
    if (stepIndex === 2) {
      return Boolean(errors.clientName || errors.clientEmail);
    }
    if (stepIndex === 3) {
      return Boolean(errors.invoiceDate || errors.hourlyRate);
    }
    return false;
  }

  function stepIsComplete(stepIndex) {
    if (stepHasBlockingErrors(stepIndex)) {
      return false;
    }
    if (stepIndex === 4) {
      return calculations.totalHours > 0;
    }
    return true;
  }

  function goToStep(index) {
    setActiveStep(Math.max(0, Math.min(formSteps.length - 1, index)));
  }

  function handleWorkflowTouchStart(event) {
    if (presetModalOpen || event.touches.length !== 1 || isTouchNavigationExcluded(event.target)) {
      workflowTouchSkipRef.current = true;
      workflowTouchStartRef.current = null;
      return;
    }

    const touch = event.touches[0];
    workflowTouchSkipRef.current = false;
    workflowTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
    workflowTouchDeltaRef.current = { x: 0, y: 0 };
    setWorkflowSwipeOffset(0);
    setWorkflowIsSwiping(false);
  }

  function handleWorkflowTouchMove(event) {
    if (workflowTouchSkipRef.current || !workflowTouchStartRef.current || event.touches.length !== 1) {
      return;
    }

    const touch = event.touches[0];
    workflowTouchDeltaRef.current = {
      x: touch.clientX - workflowTouchStartRef.current.x,
      y: touch.clientY - workflowTouchStartRef.current.y,
    };

    const { x, y } = workflowTouchDeltaRef.current;
    const hasHorizontalIntent = Math.abs(x) > 8 && Math.abs(x) > Math.abs(y) * 1.15;
    if (!hasHorizontalIntent) {
      return;
    }

    const atFirstStep = activeStep === 0 && x > 0;
    const atLastStep = activeStep === stepCount - 1 && x < 0;
    const resistance = atFirstStep || atLastStep ? 0.28 : 1;
    setWorkflowIsSwiping(true);
    setWorkflowSwipeOffset(Math.max(-34, Math.min(34, x * 0.34 * resistance)));
  }

  function handleWorkflowTouchEnd() {
    const delta = workflowTouchDeltaRef.current;
    const shouldChangeStep =
      !workflowTouchSkipRef.current &&
      workflowTouchStartRef.current &&
      Math.abs(delta.x) >= 34 &&
      Math.abs(delta.x) > Math.abs(delta.y) * 1.22;

    if (shouldChangeStep) {
      const direction = delta.x < 0 ? 1 : -1;
      setActiveStep((currentStep) => Math.max(0, Math.min(stepCount - 1, currentStep + direction)));
    }

    workflowTouchSkipRef.current = false;
    workflowTouchStartRef.current = null;
    workflowTouchDeltaRef.current = { x: 0, y: 0 };
    setWorkflowSwipeOffset(0);
    setWorkflowIsSwiping(false);
  }

  function getKeyboardFocusableElements(container) {
    if (!container) {
      return [];
    }
    return Array.from(container.querySelectorAll(WORKFLOW_FOCUS_SELECTOR)).filter((element) => {
      if (element.classList.contains("sr-only") || element.closest(".sr-only")) {
        return false;
      }
      if (element.getAttribute("aria-hidden") === "true") {
        return false;
      }
      return element.offsetParent !== null || element === document.activeElement;
    });
  }

  function focusElement(element) {
    if (element && typeof element.focus === "function") {
      element.focus({ preventScroll: true });
    }
  }

  function focusStepTab(index) {
    requestAnimationFrame(() => {
      focusElement(stepTabRefs.current[index]);
    });
  }

  function focusStepContent(index = activeStep, direction = "first") {
    setActiveStep(index);
    requestAnimationFrame(() => {
      const focusableElements = getKeyboardFocusableElements(stepPaneRef.current);
      const target =
        direction === "last"
          ? focusableElements[focusableElements.length - 1]
          : focusableElements[0];
      focusElement(target);
    });
  }

  function handleStepTabKeyDown(event, index) {
    if (event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const lastStepIndex = formSteps.length - 1;
    let nextStepIndex = index;

    if (event.key === "ArrowRight") {
      nextStepIndex = index === lastStepIndex ? 0 : index + 1;
    } else if (event.key === "ArrowLeft") {
      nextStepIndex = index === 0 ? lastStepIndex : index - 1;
    } else if (event.key === "Home") {
      nextStepIndex = 0;
    } else if (event.key === "End") {
      nextStepIndex = lastStepIndex;
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      focusStepContent(index);
      return;
    } else {
      return;
    }

    event.preventDefault();
    setActiveStep(nextStepIndex);
    focusStepTab(nextStepIndex);
  }

  function handleStepPaneKeyDown(event) {
    if (
      (event.key !== "ArrowDown" && event.key !== "ArrowUp") ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }

    const focusableElements = getKeyboardFocusableElements(stepPaneRef.current);
    const currentIndex = focusableElements.indexOf(document.activeElement);

    if (currentIndex === -1) {
      return;
    }

    event.preventDefault();

    if (event.key === "ArrowDown") {
      if (currentIndex < focusableElements.length - 1) {
        focusElement(focusableElements[currentIndex + 1]);
        return;
      }
      if (activeStep < formSteps.length - 1) {
        focusStepContent(activeStep + 1);
      }
      return;
    }

    if (currentIndex > 0) {
      focusElement(focusableElements[currentIndex - 1]);
      return;
    }
    focusStepTab(activeStep);
  }

  function shiftInvoiceMonth(monthDelta) {
    setForm((prev) => {
      const nextMonth = shiftMonthValue(prev.invoiceMonth, monthDelta);
      const bounds = parseMonthValue(nextMonth);
      return {
        ...prev,
        invoiceMonth: nextMonth,
        ...(bounds
          ? {
              periodStart: toISODate(bounds.start),
              periodEnd: toISODate(bounds.end),
            }
          : {}),
      };
    });
  }

  return (
    <>
      <div className={`app-shell ${presetModalOpen ? "dialog-open" : ""}`}>
      <div className="app-content" aria-hidden={presetModalOpen ? "true" : undefined}>
        <header className="topbar">
          <div className="topbar-main">
            <div className="brand-copy">
              <h1>Invoice Garden</h1>
              <p className="mobile-desktop-note">
                Designed for desktop. Use a desktop browser for the intended experience.
              </p>
            </div>
          </div>
          <div className="preset-strip topbar-presets" aria-label="Invoice Garden presets">
            <div className="preset-dropdown" ref={presetDropdownRef}>
              <button
                type="button"
                className={`preset-trigger ${selectedPreset ? "has-selection" : ""}`}
                onClick={() => setIsPresetMenuOpen((isOpen) => !isOpen)}
                aria-haspopup="listbox"
                aria-expanded={isPresetMenuOpen}
                aria-label="Preset"
              >
                <span>{selectedPreset?.name || "New preset"}</span>
                <ChevronDown size={14} aria-hidden="true" />
              </button>
              {isPresetMenuOpen ? (
                <div className="preset-menu" role="listbox" aria-label="Preset options">
                  <button
                    type="button"
                    className={`preset-option ${!selectedPreset ? "selected" : ""}`}
                    role="option"
                    aria-selected={!selectedPreset}
                    onClick={() => {
                      selectPreset("");
                      setIsPresetMenuOpen(false);
                    }}
                  >
                    New preset
                  </button>
                  {availablePresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      className={`preset-option ${preset.builtIn ? "preset-option--built-in" : ""} ${
                        preset.id === selectedPresetId ? "selected" : ""
                      }`}
                      role="option"
                      aria-selected={preset.id === selectedPresetId}
                      onClick={() => {
                        selectPreset(preset.id);
                        setIsPresetMenuOpen(false);
                      }}
                    >
                      {preset.name}
                    </button>
                  ))}
                  <div className="preset-menu-divider" role="presentation" />
                  <button type="button" className="preset-option preset-utility-option" onClick={openPresetImport}>
                    <Upload size={13} aria-hidden="true" />
                    <span>Import preset backup</span>
                  </button>
                  <button
                    type="button"
                    className="preset-option preset-utility-option"
                    onClick={exportPresets}
                    disabled={!selectedUserPreset}
                  >
                    <Download size={13} aria-hidden="true" />
                    <span>Export this preset</span>
                  </button>
                </div>
              ) : null}
            </div>
            <div className="preset-controls" aria-label="Preset actions">
              <input
                ref={presetImportInputRef}
                className="sr-only"
                type="file"
                accept="application/json,.json"
                onChange={importPresetBackup}
                data-key-nav-skip="true"
              />
              <button
                type="button"
                className="icon-button preset-save-button"
                onClick={openPresetDialog}
                aria-label="Save or rename preset"
                title="Save or rename preset"
              >
                <Save size={15} />
              </button>
              <button
                type="button"
                className="icon-button preset-delete-button"
                onClick={openDeletePresetDialog}
                disabled={!selectedUserPreset}
                aria-label="Delete selected preset"
                title="Delete selected preset"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        </header>

        <main className="workspace">
        <section
          className="panel form-panel"
          aria-label="Invoice form"
          onTouchStart={handleWorkflowTouchStart}
          onTouchMove={handleWorkflowTouchMove}
          onTouchEnd={handleWorkflowTouchEnd}
          onTouchCancel={handleWorkflowTouchEnd}
        >
          <div className="stepper-header">
            <div className="step-tabs">
              {formSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isActive = index === activeStep;
                const isComplete = stepIsComplete(index);
                return (
                  <button
                    key={step.title}
                    ref={(node) => {
                      stepTabRefs.current[index] = node;
                    }}
                    type="button"
                    className={`step-tab ${isActive ? "active" : ""} ${isComplete ? "complete" : ""}`}
                    onClick={() => goToStep(index)}
                    onKeyDown={(event) => handleStepTabKeyDown(event, index)}
                    aria-current={isActive ? "step" : undefined}
                  >
                    <StepIcon size={15} strokeWidth={2.35} />
                    <span>{step.title}</span>
                  </button>
                );
              })}
            </div>
            <div className="step-dots" aria-label="Step navigation">
              {formSteps.map((step, index) => (
                <button
                  key={`${step.title}-dot`}
                  type="button"
                  className={`step-dot ${index === activeStep ? "active" : ""}`}
                  onClick={() => goToStep(index)}
                  aria-label={`Go to ${step.title}`}
                >
                  <span className="sr-only">{`Go to ${step.title}`}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            className={`step-pane ${workflowIsSwiping ? "is-swiping" : ""}`}
            ref={stepPaneRef}
            onKeyDown={handleStepPaneKeyDown}
            style={{ "--swipe-offset": `${workflowSwipeOffset}px` }}
          >
            <h2 className="sr-only">{formSteps[activeStep].title}</h2>
            {activeStep === 1 ? (
              <div className="section">
                <div className="field-grid">
                  <FormField label="Name" required error={fieldError("businessName")}>
                    <input
                      name="businessName"
                      value={form.businessName}
                      maxLength={FIELD_LIMITS.businessName}
                      onChange={handleInputChange}
                      onBlur={markTouched}
                      placeholder="Studio Operator"
                      className={fieldError("businessName") ? "invalid" : ""}
                    />
                  </FormField>

                  <FormField label="Email" required error={fieldError("businessEmail")}>
                    <input
                      name="businessEmail"
                      type="email"
                      value={form.businessEmail}
                      maxLength={FIELD_LIMITS.businessEmail}
                      onChange={handleInputChange}
                      onBlur={markTouched}
                      placeholder="hello@yourbusiness.com"
                      className={fieldError("businessEmail") ? "invalid" : ""}
                    />
                  </FormField>
                </div>
                <div className="field-grid">
                  <FormField label="Mobile">
                    <input
                      name="businessPhone"
                      type="tel"
                      value={form.businessPhone}
                      maxLength={FIELD_LIMITS.businessPhone}
                      onChange={handleInputChange}
                      placeholder="+44 7700 900000"
                    />
                  </FormField>
                  <FormField label="Postcode">
                    <input
                      name="businessPostcode"
                      value={form.businessPostcode}
                      maxLength={FIELD_LIMITS.businessPostcode}
                      onChange={handleInputChange}
                      placeholder="W1 2AB"
                    />
                  </FormField>
                </div>
                <FormField label="Address">
                  <input
                    name="businessAddress"
                    value={form.businessAddress}
                    maxLength={FIELD_LIMITS.businessAddress}
                    onChange={handleInputChange}
                    placeholder="24 Linden Street, London"
                  />
                </FormField>
              </div>
            ) : null}

            {activeStep === 2 ? (
              <div className="section">
                <div className="field-grid">
                  <FormField label="Name" required error={fieldError("clientName")}>
                    <input
                      name="clientName"
                      value={form.clientName}
                      maxLength={FIELD_LIMITS.clientName}
                      onChange={handleInputChange}
                      onBlur={markTouched}
                      placeholder="Example Client Ltd"
                      className={fieldError("clientName") ? "invalid" : ""}
                    />
                  </FormField>
                  <FormField label="Email" required error={fieldError("clientEmail")}>
                    <input
                      name="clientEmail"
                      type="email"
                      value={form.clientEmail}
                      maxLength={FIELD_LIMITS.clientEmail}
                      onChange={handleInputChange}
                      onBlur={markTouched}
                      placeholder="accounts@client.com"
                      className={fieldError("clientEmail") ? "invalid" : ""}
                    />
                  </FormField>
                </div>
                <div className="field-grid">
                  <FormField label="Mobile">
                    <input
                      name="clientPhone"
                      type="tel"
                      value={form.clientPhone}
                      maxLength={FIELD_LIMITS.clientPhone}
                      onChange={handleInputChange}
                      placeholder="+44 7700 900001"
                    />
                  </FormField>
                  <FormField label="Postcode">
                    <input
                      name="clientPostcode"
                      value={form.clientPostcode}
                      maxLength={FIELD_LIMITS.clientPostcode}
                      onChange={handleInputChange}
                      placeholder="M1 3AB"
                    />
                  </FormField>
                </div>
                <FormField label="Address">
                  <input
                    name="clientAddress"
                    value={form.clientAddress}
                    maxLength={FIELD_LIMITS.clientAddress}
                    onChange={handleInputChange}
                    placeholder="12 Market Lane, Manchester"
                  />
                </FormField>
              </div>
            ) : null}

            {activeStep === 3 ? (
              <div className="section">
                <div className="field-grid">
                  <FormField label="Number" error={fieldError("invoiceNumber")}>
                    <input
                      name="invoiceNumber"
                      value={form.invoiceNumber}
                      maxLength={FIELD_LIMITS.invoiceNumber}
                      onChange={handleInputChange}
                      onBlur={markTouched}
                      placeholder="INV-001"
                      className={fieldError("invoiceNumber") ? "invalid" : ""}
                    />
                  </FormField>
                  <FormField label="Date" required error={fieldError("invoiceDate")}>
                    <div className="date-input-row">
                      <AppDatePicker
                        value={form.invoiceDate}
                        viewMonth={datePickerViewMonth}
                        isOpen={openControl === "invoiceDate"}
                        onOpen={() => openControlPicker("invoiceDate")}
                        onSelect={(value) => selectControlValue("invoiceDate", value)}
                        onViewMonthChange={setDatePickerViewMonth}
                      />
                      <button type="button" className="ghost-button date-today-button" onClick={setInvoiceDateToToday}>
                        Today
                      </button>
                    </div>
                  </FormField>
                </div>

                <div className="field-grid">
                  <FormField label="Currency">
                    <AppDropdown
                      value={activeCurrency}
                      options={CURRENCY_OPTIONS}
                      isOpen={openControl === "currency"}
                      onOpen={() => openControlPicker("currency")}
                      onSelect={(value) => selectControlValue("currency", value)}
                      ariaLabel="Currency"
                    />
                  </FormField>
                  <FormField label="Rate" required error={fieldError("hourlyRate")}>
                    <input
                      name="hourlyRate"
                      type="number"
                      min="0"
                      max={MAX_HOURLY_RATE}
                      step="0.01"
                      value={form.hourlyRate}
                      onChange={handleNumberChange}
                      onBlur={markTouched}
                      placeholder="40"
                      className={fieldError("hourlyRate") ? "invalid" : ""}
                    />
                  </FormField>
                </div>
              </div>
            ) : null}

            {activeStep === 0 ? (
              <div className="section">
                <div className="month-picker-strip">
                  <button
                    type="button"
                    className="ghost-button month-nav-button"
                    onClick={() => shiftInvoiceMonth(-1)}
                    aria-label="Select previous month"
                    data-key-nav-skip="true"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <FormField label="Month">
                    <AppMonthPicker
                      value={form.invoiceMonth}
                      viewYear={monthPickerYear}
                      isOpen={openControl === "invoiceMonth"}
                      onOpen={() => openControlPicker("invoiceMonth")}
                      onSelect={(value) => selectControlValue("invoiceMonth", value)}
                      onYearChange={setMonthPickerYear}
                      onSelectCurrentMonth={setInvoiceMonthToCurrent}
                    />
                  </FormField>
                  <button
                    type="button"
                    className="ghost-button month-nav-button"
                    onClick={() => shiftInvoiceMonth(1)}
                    aria-label="Select next month"
                    data-key-nav-skip="true"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
                <div className="field-grid">
                  <FormField label="Start" required error={fieldError("periodStart")}>
                    <AppDatePicker
                      value={form.periodStart}
                      viewMonth={datePickerViewMonth}
                      min={monthBounds ? toISODate(monthBounds.start) : undefined}
                      max={monthBounds ? form.periodEnd || toISODate(monthBounds.end) : undefined}
                      isOpen={openControl === "periodStart"}
                      onOpen={() => openControlPicker("periodStart")}
                      onSelect={(value) => selectControlValue("periodStart", value)}
                      onViewMonthChange={setDatePickerViewMonth}
                    />
                  </FormField>
                  <FormField label="End" required error={fieldError("periodEnd")}>
                    <AppDatePicker
                      value={form.periodEnd}
                      viewMonth={datePickerViewMonth}
                      min={monthBounds ? form.periodStart || toISODate(monthBounds.start) : undefined}
                      max={monthBounds ? toISODate(monthBounds.end) : undefined}
                      isOpen={openControl === "periodEnd"}
                      onOpen={() => openControlPicker("periodEnd")}
                      onSelect={(value) => selectControlValue("periodEnd", value)}
                      onViewMonthChange={setDatePickerViewMonth}
                    />
                  </FormField>
                </div>
              </div>
            ) : null}

            {activeStep === 4 ? (
              <div className="section">
                <div
                  key={`split-hours-${clockifyImportPulse}`}
                  className={`field-grid five-col split-hours-grid ${clockifyImportPulse ? "imported" : ""}`}
                >
                  {calculations.lineRows.map((row, index) => (
                    <FormField key={row.rowKey} label={row.compactRangeLabel} className="split-hour-field">
                      <input
                        name={LINE_HOUR_FIELDS[index]}
                        type="number"
                        min="0"
                        max={MAX_LINE_HOURS}
                        step="0.25"
                        value={form[LINE_HOUR_FIELDS[index]] ?? ""}
                        onChange={handleNumberChange}
                        placeholder="0"
                      />
                    </FormField>
                  ))}
                </div>
                {!calculations.lineRows.length ? (
                  <p className="field-error">Invalid period.</p>
                ) : null}
                {clockifyImportStatus ? (
                  <div className={`import-status ${clockifyImportStatus.type}`}>
                    {clockifyImportStatus.message}
                  </div>
                ) : null}
                <div className="clockify-import-row">
                  <div className="clockify-import-copy">
                    <img className="clockify-wordmark" src={clockifyLogoUrl} alt="Clockify" />
                  </div>
                  <input
                    ref={fileInputRef}
                    className="sr-only"
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleClockifyImport}
                    data-key-nav-skip="true"
                  />
                  <button
                    type="button"
                    className="secondary-button import-button"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload size={15} />
                    Import
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <CompletionProgress
            steps={formSteps.map((step, index) => ({
              ...step,
              isComplete: stepIsComplete(index),
              isActive: index === activeStep,
            }))}
            growth={botanicalGrowth}
          />
        </section>

        <section className="panel preview-panel" aria-label="Invoice preview">
          <div className="preview-header">
            <h2>Preview</h2>
          </div>

          <article className="invoice-paper" ref={previewRef} data-pdf-preview="true">
            <header className="invoice-top">
              <div className="brand-block">
                <div>
                  <h3>{form.businessName || "Your business"}</h3>
                  <p>{form.businessEmail || "-"}</p>
                  {form.businessPhone ? <p>{form.businessPhone}</p> : null}
                  <p>{form.businessAddress || "Business address"}</p>
                  <p>{form.businessPostcode || "Postcode"}</p>
                </div>
              </div>
              <div className="invoice-meta">
                <h4>INVOICE</h4>
                <dl>
                  <div>
                    <dt>Number</dt>
                    <dd>{form.invoiceNumber || "-"}</dd>
                  </div>
                  <div>
                    <dt>Date</dt>
                    <dd>{form.invoiceDate || "-"}</dd>
                  </div>
                  <div>
                    <dt>Period</dt>
                    <dd>{calculations.periodLabel}</dd>
                  </div>
                </dl>
              </div>
            </header>

            <section className="client-block">
              <h5>Bill To</h5>
              <p className="client-name">{form.clientName || "Client name"}</p>
              <p>{form.clientEmail || "-"}</p>
              {form.clientPhone ? <p>{form.clientPhone}</p> : null}
              <p>{form.clientAddress || "Client address"}</p>
              <p>{form.clientPostcode || "Postcode"}</p>
            </section>

            <section className="line-items">
              <table className="invoice-lines-table">
                <colgroup>
                  <col className="col-timeframe" />
                  <col className="col-hours" />
                  <col className="col-rate" />
                  <col className="col-amount" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Timeframe</th>
                    <th className="numeric-col">Hours</th>
                    <th className="numeric-col">Rate</th>
                    <th className="numeric-col">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {calculations.billableRows.length > 0 ? (
                    calculations.billableRows.map((row) => (
                      <tr key={row.rowKey}>
                        <td className="timeframe-value">
                          <div className="period-cell">
                            <span>{row.rangeLabel}</span>
                          </div>
                        </td>
                        <td className="numeric-col">{formatHours(row.hours)}</td>
                        <td className="numeric-col">
                          {CURRENCY_CONFIG[activeCurrency].symbol}
                          {calculations.hourlyRate.toFixed(2)}
                        </td>
                        <td className="numeric-col">{formatCurrency(row.amount, activeCurrency)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="empty-row">
                        No billable hours yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>

            <section className="invoice-summary">
              <dl>
                <div>
                  <dt>Total hours</dt>
                  <dd>{formatHours(calculations.totalHours)}</dd>
                </div>
                <div>
                  <dt>Subtotal</dt>
                  <dd>{formatCurrency(calculations.subtotal, activeCurrency)}</dd>
                </div>
                <div className="grand-total">
                  <dt>Total due</dt>
                  <dd>{formatCurrency(calculations.totalDue, activeCurrency)}</dd>
                </div>
              </dl>
            </section>

            <footer className="invoice-footer">
              <p>Generated with Invoice Garden</p>
            </footer>
          </article>

          <div className="action-dock preview-action-dock">
            <div className="button-row">
              <button
                type="button"
                className={`primary-button export-button ${isPdfExporting ? "is-exporting" : ""}`}
                onClick={downloadPdf}
                disabled={isPdfExporting}
                title={pdfButtonTitle}
              >
                <Download size={15} />
                {isPdfExporting ? "Preparing..." : "Export PDF"}
              </button>
              <button
                type="button"
                className={`ghost-button clear-button ${isClearing ? "is-clearing" : ""}`}
                onClick={handleClearForm}
              >
                <RefreshCw size={15} />
                Clear
              </button>
            </div>
          </div>
        </section>
      </main>
      </div>

      {isPresetDialogOpen ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setIsPresetDialogOpen(false)}>
          <form
            className="preset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="preset-dialog-title"
            onSubmit={savePreset}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="preset-dialog-copy">
              <h2 id="preset-dialog-title">{selectedUserPreset ? "Rename preset" : "Save preset"}</h2>
              <p>Stored in this browser. Export a backup if you move device or browser.</p>
            </div>
            <label className="field preset-dialog-field">
              <span className="field-label">Preset name</span>
              <input
                ref={presetDialogInputRef}
                value={presetNameDraft}
                maxLength={PRESET_NAME_MAX_LENGTH}
                onChange={(event) => {
                  setPresetNameDraft(limitPresetName(event.target.value));
                  setPresetNameError("");
                }}
                className={presetNameError ? "invalid" : ""}
                placeholder="Primary client"
              />
              {presetNameError ? <span className="field-error">{presetNameError}</span> : null}
            </label>
            <div className="preset-dialog-actions">
              <button type="button" className="ghost-button" onClick={() => setIsPresetDialogOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="primary-button">
                Save
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {isPresetDeleteDialogOpen ? (
        <div className="dialog-backdrop" role="presentation" onMouseDown={() => setIsPresetDeleteDialogOpen(false)}>
          <div
            className="preset-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-preset-dialog-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="preset-dialog-copy">
              <h2 id="delete-preset-dialog-title">Delete preset</h2>
              <p>
                {selectedUserPreset ? `Remove "${selectedUserPreset.name}" from your saved presets?` : "Remove this preset?"}
              </p>
            </div>
            <div className="preset-dialog-actions">
              <button type="button" className="ghost-button" onClick={() => setIsPresetDeleteDialogOpen(false)}>
                Cancel
              </button>
              <button type="button" className="ghost-button clear-button" onClick={deleteSelectedPreset}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          <FileText size={15} />
          <span>{toast}</span>
        </div>
      ) : null}
      </div>
    </>
  );
}
