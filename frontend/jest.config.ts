import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  testEnvironment: "jest-environment-jsdom",

  // Runs after the test framework is installed in the environment.
  // This is where jest-dom matchers and MSW lifecycle are set up.
  setupFilesAfterEnv: ["<rootDir>/src/__tests__/setup/jest.setup.ts"],

  moduleNameMapper: {
    // Path alias
    "^@/(.*)$": "<rootDir>/src/$1",
    // CSS Modules
    "^.+\\.module\\.(css|sass|scss)$": "identity-obj-proxy",
    // Static file imports
    "^.+\\.(png|jpg|jpeg|gif|webp|avif|ico|bmp|svg)$":
      "<rootDir>/src/__tests__/__mocks__/fileMock.ts",
  },

  testMatch: [
    "<rootDir>/src/__tests__/**/*.test.{ts,tsx}",
    "<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}",
  ],

  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/.next/",
    "<rootDir>/src/__tests__/setup/",
    "<rootDir>/src/__tests__/utils/",
    "<rootDir>/src/__tests__/factories/",
    "<rootDir>/src/__tests__/__mocks__/",
  ],

  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: { jsx: "react-jsx" } }],
  },

  // ── Coverage ──────────────────────────────────────────────────────────
  collectCoverage: false, // Enable with --coverage flag
  coverageDirectory: "coverage",
  coverageProvider: "v8",

  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/**/*.stories.{ts,tsx}",
    "!src/__tests__/**",
    "!src/app/**/layout.tsx",
    "!src/app/**/loading.tsx",
    "!src/app/**/error.tsx",
    "!src/app/**/not-found.tsx",
    "!src/app/**/page.tsx",
    "!src/types/**",
    "!src/constants/**",
    "!src/config/**",
  ],

  coverageThreshold: {
    global: {
      branches: 80,
      functions: 85,
      lines: 85,
      statements: 85,
    },
  },

  coverageReporters: ["text", "text-summary", "lcov", "html", "json-summary"],

  // ── Performance ───────────────────────────────────────────────────────
  maxWorkers: "50%",
  testTimeout: 10000,
  clearMocks: true,
  restoreMocks: true,
  verbose: false,
};

export default createJestConfig(config);
