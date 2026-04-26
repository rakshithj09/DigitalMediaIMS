/* eslint-disable */
// @ts-check
const nextJest = require("next/jest");

// @ts-ignore
const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],
  coverageProvider: "v8",
  collectCoverageFrom: [
    "lib/**/*.{ts,tsx}",
    "app/lib/**/*.{ts,tsx}",
    "app/api/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "app/components/**/*.{ts,tsx}",
    "!**/*.d.ts",
  ],
};

module.exports = createJestConfig(customJestConfig);
