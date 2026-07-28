import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  testPathIgnorePatterns: ["<rootDir>/dist/"],
  testMatch: ["<rootDir>/src/components/**/__tests__/**/*.[jt]s?(x)"],
};

export default createJestConfig(customJestConfig);
