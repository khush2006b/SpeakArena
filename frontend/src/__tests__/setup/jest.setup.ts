/**
 * Jest setup file — executed once per test file after the test framework is installed.
 *
 * This is the place to:
 *   - Extend Jest matchers (jest-dom)
 *   - Configure MSW server lifecycle
 *   - Set global mocks that every test needs
 *   - Suppress noisy console output from libraries
 */

import "@testing-library/jest-dom";
import { server } from "@/src/__tests__/setup/msw-server";

// ---------------------------------------------------------------------------
// MSW lifecycle — start once, reset between tests, close after all tests
// ---------------------------------------------------------------------------

beforeAll(() => {
  server.listen({ onUnhandledRequest: "warn" });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// ---------------------------------------------------------------------------
// Global browser API stubs
// ---------------------------------------------------------------------------

// Stub IntersectionObserver (not available in jsdom)
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = "";
  thresholds = [];
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);
} as unknown as typeof IntersectionObserver;

// Stub ResizeObserver (not available in jsdom)
global.ResizeObserver = class ResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
} as unknown as typeof ResizeObserver;

// Stub window.matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Stub scrollTo (not available in jsdom)
window.scrollTo = jest.fn();

// Stub HTMLElement.prototype.scrollIntoView
HTMLElement.prototype.scrollIntoView = jest.fn();

// ---------------------------------------------------------------------------
// Silence noisy logs in test output
// ---------------------------------------------------------------------------

const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Silence React 19 act() warnings from async rendering in tests
  console.error = jest.fn((msg: string, ...args: unknown[]) => {
    if (
      typeof msg === "string" &&
      (msg.includes("Warning: An update to") ||
        msg.includes("not wrapped in act") ||
        msg.includes("Warning: ReactDOM.render"))
    ) {
      return;
    }
    originalConsoleError(msg, ...args);
  });

  console.warn = jest.fn((msg: string, ...args: unknown[]) => {
    // Silence known MSW / @tanstack/query warnings
    if (typeof msg === "string" && msg.includes("[MSW]")) return;
    originalConsoleWarn(msg, ...args);
  });
});

afterEach(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});
