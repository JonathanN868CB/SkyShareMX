import { afterEach, beforeEach, vi } from "vitest";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  vi.stubEnv("VITE_DEBUG_AUTH", "1");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

export {};
