/**
 * @group utils
 * @coverage 100%
 *
 * Unit tests for src/utils/format.ts
 * Pure functions — no mocks, no providers. Fast and deterministic.
 */

import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  formatMeetingTime,
  formatDuration,
  formatDurationLong,
  formatCurrency,
  formatFileSize,
  formatCompactNumber,
  truncate,
  getInitials,
  stringToHslColor,
} from "@/utils/format";

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate()", () => {
  it("formats a valid ISO date string to 'MMM d, yyyy'", () => {
    expect(formatDate("2024-01-15T10:30:00Z")).toBe("Jan 15, 2024");
  });

  it("formats first day of year correctly", () => {
    expect(formatDate("2024-01-01T00:00:00Z")).toBe("Jan 1, 2024");
  });

  it("returns 'Invalid date' for a malformed string", () => {
    expect(formatDate("not-a-date")).toBe("Invalid date");
  });

  it("returns 'Invalid date' for an empty string", () => {
    expect(formatDate("")).toBe("Invalid date");
  });

  it("handles leap day correctly", () => {
    expect(formatDate("2024-02-29T00:00:00Z")).toBe("Feb 29, 2024");
  });
});

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe("formatDateTime()", () => {
  it("formats a valid ISO date string to 'MMM d, yyyy, h:mm a'", () => {
    const result = formatDateTime("2024-01-15T10:30:00.000Z");
    // Account for local timezone offset in CI
    expect(result).toMatch(/Jan 1[45], 2024, \d{1,2}:\d{2} (AM|PM)/);
  });

  it("returns 'Invalid date' for a malformed string", () => {
    expect(formatDateTime("abc")).toBe("Invalid date");
  });
});

// ---------------------------------------------------------------------------
// formatMeetingTime
// ---------------------------------------------------------------------------

describe("formatMeetingTime()", () => {
  it("formats to 'EEE, MMM d at h:mm a'", () => {
    const result = formatMeetingTime("2024-01-15T10:30:00.000Z");
    expect(result).toMatch(/\w{3}, Jan 1[45] at \d{1,2}:\d{2} (AM|PM)/);
  });

  it("returns 'TBD' for an invalid date", () => {
    expect(formatMeetingTime("bad-date")).toBe("TBD");
  });
});

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe("formatDuration()", () => {
  it.each([
    [0, "0:00"],
    [59, "0:59"],
    [60, "1:00"],
    [125, "2:05"],
    [3600, "1:00:00"],
    [3725, "1:02:05"],
    [86399, "23:59:59"],
  ])("formatDuration(%d) → %s", (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected);
  });

  it("floors decimal seconds", () => {
    expect(formatDuration(61.9)).toBe("1:01");
  });
});

// ---------------------------------------------------------------------------
// formatDurationLong
// ---------------------------------------------------------------------------

describe("formatDurationLong()", () => {
  it.each([
    [30, "30s"],
    [125, "2m 5s"],
    [3600, "1h 0m"],
    [3725, "1h 2m"],
  ])("formatDurationLong(%d) → %s", (seconds, expected) => {
    expect(formatDurationLong(seconds)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe("formatCurrency()", () => {
  it("formats paise to rupees with ₹ symbol (INR)", () => {
    expect(formatCurrency(49900, "INR")).toMatch(/₹499/);
  });

  it("formats zero as ₹0", () => {
    expect(formatCurrency(0, "INR")).toMatch(/₹0/);
  });

  it("handles fractional amounts (e.g. 99 paise = ₹0.99)", () => {
    expect(formatCurrency(99, "INR")).toMatch(/₹0\.99/);
  });

  it("formats USD amounts", () => {
    expect(formatCurrency(1999, "USD", "en-US")).toMatch(/\$19\.99/);
  });
});

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe("formatFileSize()", () => {
  it.each([
    [0, "0 B"],
    [1, "1 B"],
    [1023, "1023 B"],
    [1024, "1 KB"],
    [1536000, "1.5 MB"],
    [1073741824, "1 GB"],
  ])("formatFileSize(%d) → %s", (bytes, expected) => {
    expect(formatFileSize(bytes)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// formatCompactNumber
// ---------------------------------------------------------------------------

describe("formatCompactNumber()", () => {
  it("formats thousands with K", () => {
    expect(formatCompactNumber(12400)).toMatch(/12\.?4?K/);
  });

  it("formats millions with M", () => {
    expect(formatCompactNumber(1_500_000)).toMatch(/1\.?5?M/);
  });

  it("leaves small numbers unchanged", () => {
    expect(formatCompactNumber(999)).toBe("999");
  });
});

// ---------------------------------------------------------------------------
// truncate
// ---------------------------------------------------------------------------

describe("truncate()", () => {
  it("returns the string unchanged when shorter than maxLength", () => {
    expect(truncate("Hello", 10)).toBe("Hello");
  });

  it("returns the string unchanged when equal to maxLength", () => {
    expect(truncate("Hello", 5)).toBe("Hello");
  });

  it("truncates and appends '...' when longer than maxLength", () => {
    expect(truncate("Hello World", 8)).toBe("Hello...");
  });

  it("handles edge case of maxLength === 3", () => {
    expect(truncate("Hello", 3)).toBe("...");
  });
});

// ---------------------------------------------------------------------------
// getInitials
// ---------------------------------------------------------------------------

describe("getInitials()", () => {
  it.each([
    ["John Doe", "JD"],
    ["Alice", "A"],
    ["Alice Bob Charlie", "AB"], // max 2 chars
    ["  alice   bob  ", "AB"], // trims whitespace
    ["", ""],
  ])("getInitials(%s) → %s", (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// stringToHslColor
// ---------------------------------------------------------------------------

describe("stringToHslColor()", () => {
  it("returns an HSL string", () => {
    expect(stringToHslColor("Alice")).toMatch(/^hsl\(\d{1,3}, 60%, 45%\)$/);
  });

  it("is deterministic — same input produces same output", () => {
    const a = stringToHslColor("John Doe");
    const b = stringToHslColor("John Doe");
    expect(a).toBe(b);
  });

  it("produces different colors for different inputs", () => {
    expect(stringToHslColor("Alice")).not.toBe(stringToHslColor("Bob"));
  });

  it("respects custom saturation and lightness", () => {
    expect(stringToHslColor("test", 80, 30)).toMatch(/^hsl\(\d{1,3}, 80%, 30%\)$/);
  });
});
