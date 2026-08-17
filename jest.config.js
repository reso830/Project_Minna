import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  testPathIgnorePatterns: ["<rootDir>/dist/"],
  testMatch: [
    "<rootDir>/src/components/**/__tests__/**/*.[jt]s?(x)",
    "<rootDir>/src/app/api/**/__tests__/**/*.[jt]s?(x)",
  ],
};

export default createJestConfig(customJestConfig);
