// jest.setup.ts
import "@testing-library/jest-dom";
import { toHaveNoViolations } from "jest-axe";
import { server } from "./src/__tests__/setup/server";

// Extend expect with jest-axe
expect.extend(toHaveNoViolations);

beforeAll(() => {
  // Start the MSW server before all tests
  server.listen({ onUnhandledRequest: "error" });
  
  // Mock window.matchMedia for tests (useful for dark mode checks)
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: jest.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // Deprecated
      removeListener: jest.fn(), // Deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
});

afterEach(() => {
  // Reset any runtime request handlers we may add during the tests
  server.resetHandlers();
});

afterAll(() => {
  // Clean up once the tests are done
  server.close();
});
